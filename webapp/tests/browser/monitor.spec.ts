import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { WebSocketServer } from 'ws'
import type { AddressInfo } from 'node:net'
import { readFile } from 'node:fs/promises'

let server: WebSocketServer
let endpoint: string
let payload: string | null
let connections = 0

test.beforeAll(async () => {
  server = new WebSocketServer({ host: '127.0.0.1', port: 0, path: '/ws' })
  await new Promise<void>((resolve) => server.once('listening', resolve))
  endpoint = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`
  server.on('connection', (socket) => {
    connections++
    const timer = setInterval(() => {
      if (payload !== null && socket.readyState === 1) socket.send(payload)
    }, 100)
    socket.once('close', () => clearInterval(timer))
  })
})
test.beforeEach(() => {
  payload = '{"temperature":1.25,"voltage":2.5,"current":3.75}'
})
test.afterAll(async () => {
  for (const client of server.clients) client.terminate()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

async function openMonitorSettings(page: Page) {
  await page.goto('/connection')
  await page.getByText('Conexión del monitor · opciones avanzadas', { exact: true }).click()
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click()
}

test('inicio sin lecturas inventadas, navegación y validación de dirección', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByTestId('value-temperature')).toHaveText('—')
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled()
  await openMonitorSettings(page)
  await page.getByLabel('Dirección WebSocket').fill('http://esp32.local/ws')
  await page.getByRole('button', { name: 'Conectar monitor' }).click()
  await expect(page.getByRole('alert')).toContainText('ws:// o wss://')
  await page.getByRole('link', { name: 'Protocolo de datos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Un mensaje, tres canales' })).toBeVisible()
  await expect(page.locator('pre')).toContainText('"temperature": -12.3456')
  await page.getByRole('link', { name: 'Conexión', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Configura la recepción' })).toBeVisible()
  expect(errors).toEqual([])
})

test('demo identificada, pausa independiente de recepción y exportación CSV', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Probar demo' }).click()
  await expect(page.getByText('Modo de simulación.')).toBeVisible()
  await expect(page.getByTestId('value-temperature')).not.toHaveText('—')
  await page.clock.runFor(31_000)
  await page.screenshot({ path: 'artifacts/voltio-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Pausar gráfica', exact: true }).click()
  const points = await page.locator('polyline').first().getAttribute('points')
  const count = await page.getByTestId('valid-messages').innerText()
  await page.clock.runFor(1_100)
  expect(await page.getByTestId('valid-messages').innerText()).not.toBe(count)
  expect(await page.locator('polyline').first().getAttribute('points')).toBe(points)
  await page.getByRole('button', { name: 'Reanudar gráfica' }).click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toContain('simulacion')
  const csv = await readFile(await download.path(), 'utf8')
  expect(csv).toContain('fecha_iso,temperature_c,voltage_v,current_a')
  expect(csv.split('\r\n').length).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Detener simulación', exact: true }).click()
  await expect(page.getByText('Simulación detenida.')).toBeVisible()
})

test('socket real, valores exactos, mensajes inválidos y reconexión', async ({ page }) => {
  await page.goto('/')
  await openMonitorSettings(page)
  await page.getByLabel('Dirección WebSocket').fill(endpoint)
  await page.getByRole('button', { name: 'Conectar monitor' }).click()
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  for (const [channel, value] of [
    ['temperature', '1.25'],
    ['voltage', '2.50'],
    ['current', '3.75'],
  ] as const)
    await expect(page.getByTestId(`value-${channel}`)).toHaveText(value)
  await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
  payload = '{"temperature":101,"voltage":2,"current":3}'
  await expect(page.getByRole('alert')).toContainText('Mensaje descartado')
  await expect(page.getByTestId('value-temperature')).toHaveText('1.25')
  payload = '{"temperature":0,"voltage":5,"current":2.75}'
  await expect(page.getByTestId('value-temperature')).toHaveText('0.00')
  await expect(page.getByTestId('value-voltage')).toHaveText('5.00')
  const before = connections
  for (const socket of server.clients) socket.terminate()
  await expect.poll(() => connections).toBeGreaterThan(before)
  await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
  await page.getByRole('link', { name: 'Conexión', exact: true }).click()
  await page.getByText('Conexión del monitor · opciones avanzadas', { exact: true }).click()
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click()
  await expect(page.getByTestId('connection-status')).toHaveText('Sin conexión')
  await expect(page.getByLabel('Dirección WebSocket')).toBeEnabled()
  await page.reload()
  await page.getByText('Conexión del monitor · opciones avanzadas', { exact: true }).click()
  await expect(page.getByLabel('Dirección WebSocket')).toHaveValue(endpoint)
  await expect(page.getByTestId('connection-status')).toHaveText('Sin conexión')
})

test('una sesión nueva reanuda la gráfica pausada de la sesión anterior', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Probar demo', exact: true }).click()
  await expect(page.getByTestId('value-temperature')).not.toHaveText('—')
  await page.getByRole('button', { name: 'Pausar gráfica', exact: true }).click()
  await expect(page.getByText('Gráfica pausada', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Detener simulación', exact: true }).click()
  await page.getByRole('button', { name: 'Probar demo', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pausar gráfica', exact: true })).toBeEnabled()
  await expect(page.getByText('Gráfica pausada', { exact: true })).toBeHidden()
})

test('detecta un socket abierto sin telemetría y conserva la última lectura', async ({ page }) => {
  await page.goto('/')
  await openMonitorSettings(page)
  await page.getByLabel('Dirección WebSocket').fill(endpoint)
  await page.getByRole('button', { name: 'Conectar monitor' }).click()
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  await expect(page.getByTestId('value-temperature')).toHaveText('1.25')
  payload = null
  await expect(page.getByTestId('connection-status')).toHaveText('Sin datos recientes', {
    timeout: 6_000,
  })
  await expect(page.getByTestId('value-temperature')).toHaveText('1.25')
})

test('diseño móvil sin desbordamiento, ventana y canales visibles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Probar demo' }).click()
  await page.getByRole('button', { name: '120 s', exact: true }).click()
  await expect(page.getByRole('button', { name: '120 s', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Voltaje', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Voltaje', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.evaluate(() => scrollTo(0, 0))
  await page.screenshot({ path: 'artifacts/voltio-mobile.png' })
})
