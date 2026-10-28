import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createNgrokDiscovery, parseNgrokOrigins } from '../server/ngrok-discovery.ts'
import { DEFAULT_GATEWAY_CONFIG } from '../server/gateway-config.ts'
import { senderUrl } from '../src/shared/contracts/gateway.ts'

await test('descubre solo endpoints HTTPS que apuntan al puerto local de Voltio', () => {
  assert.deepEqual(parseNgrokOrigins({ endpoints: [
    { url: 'https://voltio.ngrok-free.dev', upstream: { url: 'http://localhost:5173' } },
    { url: 'https://otro.ngrok-free.dev', upstream: { url: 'http://localhost:8000' } },
    { url: 'https://remoto.ngrok-free.dev', upstream: { url: 'http://other-machine:5173' } },
    { url: 'http://sin-tls.ngrok-free.dev', upstream: { url: '5173' } },
    { url: 'https://invalid.example/path', upstream: { url: '5173' } },
    { url: 'https://user:password@invalid.example', upstream: { url: '5173' } },
    null,
  ] }, 5173), ['https://voltio.ngrok-free.dev'])
  for (const addr of ['5173', 5173, 'localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173']) {
    assert.deepEqual(parseNgrokOrigins({ tunnels: [
      { public_url: 'https://demo.ngrok.app', config: { addr } },
    ] }, 5173), ['https://demo.ngrok.app'])
  }
  for (const invalid of [null, [], {}, { endpoints: [null, {}] }])
    assert.deepEqual(parseNgrokOrigins(invalid, 5173), [])
})

await test('localhost usa el WSS descubierto y conserva la URL pública elegida expresamente', () => {
  const detected = 'https://actual.ngrok-free.dev'
  assert.equal(senderUrl(DEFAULT_GATEWAY_CONFIG, 'http://localhost:5173', ['192.168.1.64'], detected),
    'wss://actual.ngrok-free.dev/ws/esp32?device=esp32-01')
  assert.equal(senderUrl(DEFAULT_GATEWAY_CONFIG, 'http://192.168.1.64:5173', ['192.168.1.64'], detected),
    'wss://actual.ngrok-free.dev/ws/esp32?device=esp32-01')
  assert.equal(senderUrl(DEFAULT_GATEWAY_CONFIG, 'https://abierto.ngrok.dev', [], detected),
    'wss://abierto.ngrok.dev/ws/esp32?device=esp32-01')
  assert.equal(senderUrl({ ...DEFAULT_GATEWAY_CONFIG, publicOrigin: 'https://manual.example' },
    'http://localhost:5173', [], detected), 'wss://manual.example/ws/esp32?device=esp32-01')
})

await test('detecta arranque, cambio y retirada del túnel, y recupera la API antigua', async () => {
  let available = true
  let legacy = false
  let hang = false
  let entries = [{ url: 'https://primero.ngrok.dev', upstream: { url: 'http://localhost:5173' } }]
  const agent = createServer((request, response) => {
    if (hang) return
    if (!available) { response.writeHead(503); response.end(); return }
    if (legacy && request.url === '/api/endpoints') { response.writeHead(404); response.end(); return }
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(legacy
      ? { tunnels: entries.map((entry) => ({ public_url: entry.url, config: { addr: entry.upstream.url } })) }
      : { endpoints: entries }))
  })
  await new Promise<void>((resolve) => agent.listen(0, '127.0.0.1', resolve))
  const discovery = createNgrokDiscovery({
    getPort: () => 5173, agentOrigin: `http://127.0.0.1:${(agent.address() as AddressInfo).port}`,
    intervalMs: 10_000, timeoutMs: 40, staleAfterMs: 100,
  })
  try {
    await discovery.refresh()
    assert.equal(discovery.getOrigin(), 'https://primero.ngrok.dev')
    entries = [{ url: 'https://segundo.ngrok.dev', upstream: { url: 'http://localhost:5173' } }]
    legacy = true
    await discovery.refresh()
    assert.equal(discovery.getOrigin(), 'https://segundo.ngrok.dev')
    available = false
    await discovery.refresh()
    assert.equal(discovery.getOrigin(), 'https://segundo.ngrok.dev')
    await new Promise((resolve) => setTimeout(resolve, 120))
    assert.equal(discovery.getOrigin(), null)
    available = true
    await discovery.refresh()
    assert.equal(discovery.getOrigin(), 'https://segundo.ngrok.dev')
    hang = true
    const before = Date.now()
    await discovery.refresh()
    assert.ok(Date.now() - before < 500)
    hang = false
    entries = []
    await discovery.refresh()
    assert.equal(discovery.getOrigin(), null)
  } finally {
    discovery.close()
    agent.closeAllConnections()
    await new Promise<void>((resolve) => agent.close(() => resolve()))
  }
})
