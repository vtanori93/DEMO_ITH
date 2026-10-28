import { test, expect } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'
import { WebSocket } from 'ws'
import { once } from 'node:events'

const defaults = { senderPath: '/ws/esp32', deviceId: 'esp32-01', publicOrigin: '', enabled: true }
const sockets = new Set<WebSocket>()
test.beforeEach(async ({ request }) => {
  await request.put('/api/gateway/config', { data: { ...defaults, enabled: false } })
  await request.put('/api/gateway/config', { data: defaults })
})
test.afterEach(async ({ request }) => {
  for (const socket of sockets) socket.terminate()
  sockets.clear()
  await request.put('/api/gateway/config', { data: { ...defaults, enabled: false } })
  await request.put('/api/gateway/config', { data: defaults })
})
async function sender() {
  const socket = new WebSocket('ws://127.0.0.1:5174/ws/esp32?device=esp32-01')
  sockets.add(socket)
  await once(socket, 'open')
  return socket
}

test('recibe a 1 Hz, conserva lecturas durante cortes y recupera el monitor varias veces', async ({ page }) => {
  const connections: WebSocketRoute[] = []
  await page.routeWebSocket('**/ws/monitor', (route) => {
    route.connectToServer()
    connections.push(route)
  })
  const device = await sender()
  await page.goto('/monitor')
  await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
  let sample = 0
  const send = () => {
    const value = 1 + (++sample % 8) / 10
    device.send(JSON.stringify({ temperature: value, voltage: 2.5, current: 3.75 }))
  }
  send()
  const timer = setInterval(send, 1_000)
  try {
    await expect.poll(() => page.getByTestId('valid-messages').innerText()).not.toBe('0')
    for (let index = 0; index < 2; index++) {
      const previous = connections.at(-1)
      expect(previous).toBeDefined()
      if (!previous) throw new Error('Falta el socket del monitor.')
      const count = Number(await page.getByTestId('valid-messages').innerText())
      await previous.close({ code: 1012, reason: 'Corte de prueba' })
      await expect(page.getByTestId('value-temperature')).not.toHaveText('—')
      await expect.poll(() => connections.length).toBe(index + 2)
      await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
      await expect.poll(async () => Number(await page.getByTestId('valid-messages').innerText())).toBeGreaterThan(count)
    }
    await expect.poll(() => page.locator('polyline').evaluateAll((lines) =>
      lines.some((line) => (line.getAttribute('points') ?? '').trim().split(/\s+/).length >= 3),
    )).toBe(true)
    device.send('{mensaje-invalido')
    await expect(page.getByTestId('invalid-messages')).toHaveText('1')
    send()
    await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
    await expect(page.getByTestId('value-temperature')).not.toHaveText('—')
  } finally {
    clearInterval(timer)
  }
})

test('un heartbeat mantiene el socket vivo sin inventar mediciones', async ({ page }) => {
  const connections: WebSocketRoute[] = []
  await page.routeWebSocket('**/ws/monitor', (route) => {
    route.connectToServer()
    connections.push(route)
  })
  await page.goto('/monitor')
  await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
  await expect(page.getByTestId('connection-status')).toHaveText('Sin datos recientes')
  await page.waitForTimeout(5_500)
  expect(connections).toHaveLength(1)
  await expect(page.getByTestId('valid-messages')).toHaveText('0')
  await expect(page.getByTestId('invalid-messages')).toHaveText('0')
  await expect(page.getByTestId('value-temperature')).toHaveText('—')
})

test('una consulta de estado atascada expira y vuelve a funcionar sin recargar', async ({ page }) => {
  let release: () => void = () => {}
  const stalled = new Promise<void>((resolve) => { release = resolve })
  let blocked = true
  await page.route('**/api/gateway/status', async (route) => {
    if (blocked) await stalled
    await route.continue().catch(() => {})
  })
  try {
    await page.goto('/monitor')
    const device = await sender()
    device.send('{"temperature":1.25,"voltage":2.5,"current":3.75}')
    await expect(page.getByTestId('value-temperature')).toHaveText('1.25')
    await expect(page.getByText('Receptor sin respuesta. Reconectando automáticamente…', { exact: true })).toBeVisible({ timeout: 8_000 })
    blocked = false
    release()
    await expect(page.getByLabel('Dirección de recepción para el ESP32')).toHaveValue(/\/ws\/esp32\?device=esp32-01$/)
    device.send('{"temperature":4.5,"voltage":2.5,"current":3.75}')
    await expect(page.getByTestId('value-temperature')).toHaveText('4.50')
  } finally {
    blocked = false
    release()
  }
})
