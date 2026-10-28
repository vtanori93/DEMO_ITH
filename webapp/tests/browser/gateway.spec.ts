import { test, expect } from '@playwright/test'
import { WebSocket } from 'ws'
import { readFile } from 'node:fs/promises'
import { parseGatewayStatus } from '../../src/shared/contracts/gateway.ts'

const defaults = { senderPath: '/ws/esp32', deviceId: 'esp32-01', publicOrigin: '', enabled: true }
const sockets = new Set<WebSocket>()
async function connect(url: string) {
  const socket = new WebSocket(url)
  sockets.add(socket)
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  return socket
}
test.beforeEach(async ({ request }) => {
  await request.put('/api/gateway/config', { data: { ...defaults, enabled: false } })
  await request.put('/api/gateway/config', { data: defaults })
})
test.afterEach(async ({ request }) => {
  sockets.forEach((socket) => socket.terminate())
  sockets.clear()
  await request.put('/api/gateway/config', { data: { ...defaults, enabled: false } })
  await request.put('/api/gateway/config', { data: defaults })
})

test('configura en la webapp el receptor y recibe temperatura, voltaje y corriente', async ({
  page,
  request,
}) => {
  await page.goto('/connection')
  await page.getByLabel('Identificador del ESP32').fill('arduino-cliente')
  await page.getByLabel('Ruta de recepción').fill('/ws/laboratorio')
  await page
    .getByLabel('URL pública o dirección de la aplicación')
    .fill('https://laboratorio.ngrok-free.dev')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(page.getByTestId('sender-url')).toHaveValue(
    'wss://laboratorio.ngrok-free.dev/ws/laboratorio?device=arduino-cliente',
  )
  expect(parseGatewayStatus(await (await request.get('/api/gateway/status')).json()).config.senderPath).toBe(
    '/ws/laboratorio',
  )
  await page.getByLabel('URL pública o dirección de la aplicación').fill('http://127.0.0.1:5174')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(page.getByTestId('sender-url')).toHaveValue(
    'ws://127.0.0.1:5174/ws/laboratorio?device=arduino-cliente',
  )
  const endpoint = await page.getByTestId('sender-url').inputValue()
  await page.getByRole('button', { name: 'Ver datos en el monitor' }).click()
  await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
  const device = await connect(endpoint)
  device.send('{"temperature":1.25,"voltage":2.50,"current":3.75}')
  await expect(page.getByTestId('value-temperature')).toHaveText('1.25')
  await expect(page.getByTestId('value-voltage')).toHaveText('2.50')
  await expect(page.getByTestId('value-current')).toHaveText('3.75')
  await expect(page.getByText('ESP32 conectado · arduino-cliente')).toBeVisible()
  device.send('{"temperature":101,"voltage":2.50,"current":3.75}')
  await expect(page.getByRole('alert')).toContainText('Mensaje descartado')
  await expect(page.getByTestId('value-temperature')).toHaveText('1.25')
  await expect(page.getByTestId('invalid-messages')).toHaveText('1')
})

test('recupera la última lectura sin presentarla como una muestra recién recibida', async ({
  page,
  request,
}) => {
  const device = await connect('ws://127.0.0.1:5174/ws/esp32?device=esp32-01')
  device.send('{"temperature":0,"voltage":5,"current":2.75}')
  await expect
    .poll(async () => parseGatewayStatus(await (await request.get('/api/gateway/status')).json()).received)
    .toBeGreaterThan(0)
  await new Promise((resolve) => setTimeout(resolve, 3_200))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Conectar monitor', exact: true })).toHaveCount(0)
  await expect(page.getByTestId('value-temperature')).toHaveText('0.00')
  await expect(page.getByTestId('value-voltage')).toHaveText('5.00')
  await expect(page.getByTestId('connection-status')).toHaveText('Sin datos recientes')
})

test('recibe y visualiza al abrir la aplicación sin pulsar conectar ni configurar el navegador', async ({ page }) => {
  const device = await connect('ws://127.0.0.1:5174/ws/esp32?device=esp32-01')
  device.send('{"temperature":0.50,"voltage":2.50,"current":4.50}')
  await page.goto('/')
  await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
  await expect(page.getByTestId('value-temperature')).toHaveText('0.50')
  await expect(page.getByTestId('value-voltage')).toHaveText('2.50')
  await expect(page.getByTestId('value-current')).toHaveText('4.50')
  await expect(page.getByLabel('Dirección de recepción para el ESP32')).toHaveValue(
    /\/ws\/esp32\?device=esp32-01$/,
  )
  await page.reload()
  await expect(page.getByTestId('value-temperature')).toHaveText('0.50')
  device.send('{"temperature":1,"voltage":3,"current":5}')
  await expect(page.getByTestId('value-current')).toHaveText('5.00')
})

test('acepta los límites de cada variable y muestra sus unidades y escalas', async ({ page }) => {
  const device = await connect('ws://127.0.0.1:5174/ws/esp32?device=esp32-01')
  device.send('{"temperature":-30,"voltage":12,"current":50}')
  await page.goto('/monitor')
  for (const channel of [
    { name: 'Temperatura', key: 'temperature', minimum: '-30', maximum: '100', value: '-30', text: '-30.00', unit: '°C' },
    { name: 'Voltaje', key: 'voltage', minimum: '0', maximum: '12', value: '12', text: '12.00', unit: 'V' },
    { name: 'Corriente', key: 'current', minimum: '0', maximum: '50', value: '50', text: '50.00', unit: 'A' },
  ] as const) {
    await expect(page.getByTestId(`value-${channel.key}`)).toHaveText(channel.text)
    const meter = page.getByRole('meter', { name: `${channel.name}, valor actual`, exact: true })
    await expect(meter).toHaveAttribute('aria-valuemin', channel.minimum)
    await expect(meter).toHaveAttribute('aria-valuemax', channel.maximum)
    await expect(meter).toHaveAttribute('aria-valuenow', channel.value)
    await expect(meter).toContainText(channel.unit)
    await expect(page.getByTestId(`chart-${channel.key}`)).toContainText(`${channel.name} · ${channel.unit}`)
  }
  const temperature = page.getByRole('meter', { name: 'Temperatura, valor actual', exact: true })
  await expect(temperature.locator('path[stroke-dasharray]')).toHaveCount(0)
  device.send('{"temperature":0,"voltage":0,"current":0}')
  await expect(page.getByTestId('value-temperature')).toHaveText('0.00')
  const arc = await temperature.locator('path[stroke-dasharray]').getAttribute('stroke-dasharray')
  expect(parseFloat(arc ?? '')).toBeCloseTo(23.076923, 4)
  device.send('{"temperature":100,"voltage":12,"current":50}')
  await expect(page.getByTestId('value-temperature')).toHaveText('100.00')
  const valid = { temperature: 100, voltage: 12, current: 50 }
  let rejected = 0
  for (const patch of [{ temperature: -30.1 }, { voltage: 12.1 }, { current: 50.1 }]) {
    device.send(JSON.stringify({ ...valid, ...patch }))
    await expect(page.getByTestId('invalid-messages')).toHaveText(String(++rejected))
    await expect(page.getByTestId('value-temperature')).toHaveText('100.00')
    await expect(page.getByTestId('value-voltage')).toHaveText('12.00')
    await expect(page.getByTestId('value-current')).toHaveText('50.00')
  }
})

test('conserva flotantes al recibirlos, personalizar los decimales y exportar el historial', async ({ page }) => {
  const device = await connect('ws://127.0.0.1:5174/ws/esp32?device=esp32-01')
  device.send('{"temperature":-12.3456,"voltage":11.2345,"current":8.7654}')
  await page.goto('/monitor')
  const channels = [
    { key: 'temperature', name: 'Temperatura', unit: '°C', raw: '-12.3456', display: '-12.35' },
    { key: 'voltage', name: 'Voltaje', unit: 'V', raw: '11.2345', display: '11.23' },
    { key: 'current', name: 'Corriente', unit: 'A', raw: '8.7654', display: '8.77' },
  ] as const
  for (const channel of channels) {
    await expect(page.getByTestId(`value-${channel.key}`)).toHaveText(channel.display)
    await expect(page.getByRole('meter', { name: `${channel.name}, valor actual`, exact: true })).toHaveAttribute('aria-valuenow', channel.raw)
  }
  await page.getByRole('button', { name: 'Personalizar Temperatura', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Personalizar indicadores', exact: true })
  for (const channel of channels) {
    await dialog.getByRole('button', { name: `${channel.name} ${channel.unit}`, exact: true }).click()
    await dialog.getByLabel('Decimales', { exact: true }).selectOption('4')
  }
  await dialog.getByRole('button', { name: 'Guardar personalización', exact: true }).click()
  for (const channel of channels) await expect(page.getByTestId(`value-${channel.key}`)).toHaveText(channel.raw)
  device.send('{"temperature":-0.0001,"voltage":0.0001,"current":0.0001}')
  for (const channel of channels) await expect(page.getByTestId(`value-${channel.key}`)).toHaveText(channel.key === 'temperature' ? '-0.0001' : '0.0001')
  const exported = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click()
  const csv = await readFile(await (await exported).path(), 'utf8')
  expect(csv).toContain('-12.3456,11.2345,8.7654')
  expect(csv).toContain('-0.0001,0.0001,0.0001')
})
