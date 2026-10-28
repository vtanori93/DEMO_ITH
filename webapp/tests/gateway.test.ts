import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { WebSocket } from 'ws'
import { startApplication } from '../server/index.ts'
import { DEFAULT_GATEWAY_CONFIG, validateGatewayConfig } from '../server/gateway-config.ts'
import { gatewaySenderUrl, parseGatewayStatus, senderUrl } from '../src/shared/contracts/gateway.ts'
import { websocketText } from '../server/websocket-data.ts'
import { isRecord } from '../src/shared/lib/guards.ts'
import type { GatewayStatus } from '../src/shared/contracts/gateway.ts'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'voltio-receiver-'))
  await mkdir(join(root, 'dist'))
  await writeFile(join(root, 'dist/index.html'), '<!doctype html><title>Voltio</title>')
  const options = {
    port: 0,
    host: '127.0.0.1',
    directory: join(root, 'dist'),
    configFile: join(root, 'gateway.json'),
  }
  const app = await startApplication(options)
  const origin = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
  return {
    app,
    origin,
    options,
    root,
    close: async () => {
      await app.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}
async function client(url: string) {
  const socket = new WebSocket(url)
  const queue: unknown[] = []
  const waiting: Array<(value: unknown) => void> = []
  socket.on('message', (data) => {
    const parsed: unknown = JSON.parse(websocketText(data))
    const resolve = waiting.shift()
    if (resolve) resolve(parsed)
    else queue.push(parsed)
  })
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  return {
    socket,
    next: () =>
      queue.length
        ? Promise.resolve(queue.shift())
        : new Promise<unknown>((resolve) => waiting.push(resolve)),
  }
}

await test('el servidor recibe valores enviados por un ESP32 cliente y los entrega a varios monitores', async () => {
  const context = await fixture()
  const sockets: WebSocket[] = []
  try {
    const base = context.origin.replace('http:', 'ws:')
    const device = await client(`${base}/ws/esp32?device=esp32-01`)
    sockets.push(device.socket)
    const monitor = await client(`${base}/ws/monitor`)
    sockets.push(monitor.socket)
    device.socket.send('{"temperature":0,"voltage":2.5,"current":5}')
    const frame = await monitor.next()
    assert.ok(isRecord(frame))
    assert.deepEqual(frame.values, { temperature: 0, voltage: 2.5, current: 5 })
    assert.equal(frame.ageMs, 0)
    const second = await client(`${base}/ws/monitor`)
    sockets.push(second.socket)
    const secondFrame = await second.next()
    assert.ok(isRecord(secondFrame))
    assert.deepEqual(secondFrame.values, frame.values)
    device.socket.send('{"temperature":101,"voltage":2,"current":3}')
    const rejected = await monitor.next()
    assert.ok(isRecord(rejected))
    assert.equal(rejected.type, 'rejected')
    assert.equal(context.app.gateway.getStatus().received, 1)
    assert.equal(context.app.gateway.getStatus().rejected, 1)
    assert.ok(context.app.gateway.getStatus().deviceConnected)
  } finally {
    sockets.forEach((socket) => socket.terminate())
    await context.close()
  }
})

await test('el receptor distribuye valores flotantes y recupera la última fracción al reconectar un monitor', async () => {
  const context = await fixture()
  const sockets: WebSocket[] = []
  try {
    const base = context.origin.replace('http:', 'ws:')
    const device = await client(`${base}/ws/esp32?device=esp32-01`)
    sockets.push(device.socket)
    const monitor = await client(`${base}/ws/monitor`)
    sockets.push(monitor.socket)
    for (const values of [
      { temperature: -12.3456, voltage: 11.2345, current: 8.7654 },
      { temperature: -0.0001, voltage: 0.0001, current: 0.0001 },
      { temperature: -29.9999, voltage: 11.9999, current: 49.9999 },
      { temperature: -12.3456789, voltage: 1.2e-8, current: 49.123456789 },
    ]) {
      device.socket.send(JSON.stringify(values))
      const frame = await monitor.next()
      assert.ok(isRecord(frame))
      assert.deepEqual(frame.values, values)
    }
    const reconnected = await client(`${base}/ws/monitor`)
    sockets.push(reconnected.socket)
    const latest = await reconnected.next()
    assert.ok(isRecord(latest))
    assert.deepEqual(latest.values, { temperature: -12.3456789, voltage: 1.2e-8, current: 49.123456789 })
  } finally {
    sockets.forEach((socket) => socket.terminate())
    await context.close()
  }
})

await test('la configuración por API cambia la ruta y persiste al reiniciar el servidor', async () => {
  const context = await fixture()
  try {
    const config = {
      ...DEFAULT_GATEWAY_CONFIG,
      senderPath: '/ws/laboratorio',
      deviceId: 'arduino-01',
      publicOrigin: 'https://laboratorio.ngrok-free.dev',
    }
    const response = await fetch(`${context.origin}/api/gateway/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(parseGatewayStatus(await response.json()).config, config)
    await context.app.close()
    const restarted = await startApplication(context.options)
    try {
      assert.deepEqual(restarted.gateway.getStatus().config, config)
    } finally {
      await restarted.close()
    }
  } finally {
    await context.close()
  }
})

await test('valida rutas, origen público e identificador antes de aplicar ajustes', () => {
  assert.throws(() =>
    validateGatewayConfig({ ...DEFAULT_GATEWAY_CONFIG, senderPath: '/ws/monitor' }),
  )
  assert.throws(() => validateGatewayConfig({ ...DEFAULT_GATEWAY_CONFIG, deviceId: '../../other' }))
  assert.throws(() =>
    validateGatewayConfig({ ...DEFAULT_GATEWAY_CONFIG, publicOrigin: 'https://example.com/path' }),
  )
  assert.equal(
    senderUrl(DEFAULT_GATEWAY_CONFIG, 'http://localhost:5173', ['192.168.1.72']),
    'ws://192.168.1.72:5173/ws/esp32?device=esp32-01',
  )
  assert.equal(
    senderUrl(DEFAULT_GATEWAY_CONFIG, 'https://demo.ngrok-free.dev'),
    'wss://demo.ngrok-free.dev/ws/esp32?device=esp32-01',
  )
  assert.equal(
    senderUrl(DEFAULT_GATEWAY_CONFIG, 'https://127.0.0.1:4443', ['192.168.1.72']),
    'wss://127.0.0.1:4443/ws/esp32?device=esp32-01',
  )
})

await test('el dominio de entorno prevalece sobre la URL guardada y cambia sin recompilar el frontend', async () => {
  const context = await fixture()
  try {
    const config = { ...DEFAULT_GATEWAY_CONFIG, publicOrigin: 'https://anterior.ngrok-free.dev' }
    await fetch(`${context.origin}/api/gateway/config`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config),
    })
    await context.app.close()
    for (const publicOrigin of ['https://primero.ngrok-free.dev/', 'https://segundo.ngrok-free.dev:443']) {
      const app = await startApplication({ ...context.options, publicOrigin })
      try {
        const origin = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
        const status = parseGatewayStatus(await (await fetch(`${origin}/api/gateway/status`)).json())
        assert.deepEqual(status.config, config, 'El dominio del entorno no modifica los ajustes guardados.')
        assert.equal(status.environmentPublicOrigin, new URL(publicOrigin).origin)
        assert.equal(gatewaySenderUrl(status, origin),
          `${publicOrigin.includes('primero') ? 'wss://primero.ngrok-free.dev' : 'wss://segundo.ngrok-free.dev'}/ws/esp32?device=esp32-01`)
        assert.equal((await fetch(`${origin}/connection`)).status, 200)
      } finally { await app.close() }
    }
    await assert.rejects(startApplication({ ...context.options, publicOrigin: 'https://dominio.example/connection' }), /NGROK_URL/)
  } finally { await context.close() }
})

await test('valida respuestas de la API antes de aceptar configuración y métricas', () => {
  const status: GatewayStatus = {
    config: { ...DEFAULT_GATEWAY_CONFIG },
    deviceConnected: false,
    monitorCount: 1,
    received: 10,
    rejected: 0,
    lastMessageAt: 1_700_000_000_000,
    lastError: null,
    configWarning: null,
    detectedPublicOrigin: null,
    environmentPublicOrigin: null,
    lanAddresses: ['192.168.1.72'],
  }
  assert.deepEqual(parseGatewayStatus(status), status)
  assert.deepEqual(
    parseGatewayStatus({ ...status, lastMessageAt: null, lastError: 'Mensaje descartado' }),
    { ...status, lastMessageAt: null, lastError: 'Mensaje descartado' },
  )
  for (const invalid of [
    null,
    [],
    {},
    { ...status, config: null },
    { ...status, config: { ...status.config, enabled: 'true' } },
    { ...status, received: '10' },
    { ...status, rejected: -1 },
    { ...status, monitorCount: 0.5 },
    { ...status, lastMessageAt: Number.NaN },
    { ...status, lastError: 500 },
    { ...status, detectedPublicOrigin: 'http://inseguro.example' },
    { ...status, detectedPublicOrigin: 'https://example.com/path' },
    { ...status, environmentPublicOrigin: 'http://inseguro.example' },
    { ...status, environmentPublicOrigin: 'https://example.com/path' },
    { ...status, lanAddresses: [123] },
  ])
    assert.throws(() => parseGatewayStatus(invalid))
})

await test('decodifica las representaciones de datos WebSocket sin conversiones inseguras', () => {
  const payload = '{"temperature":1.25,"voltage":2.5,"current":3.75}'
  const buffer = Buffer.from(payload)
  assert.equal(websocketText(buffer), payload)
  assert.equal(websocketText([buffer.subarray(0, 8), buffer.subarray(8)]), payload)
  assert.equal(websocketText(new TextEncoder().encode(payload).buffer), payload)
})

await test('sirve las rutas y redirige documentos desconocidos al monitor sin redirigir recursos ni API', async () => {
  const context = await fixture()
  try {
    for (const path of ['/monitor', '/connection', '/protocol', '/connection/']) {
      const response = await fetch(`${context.origin}${path}`)
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type') ?? '', /text\/html/)
      assert.match(await response.text(), /<title>Voltio<\/title>/)
    }
    const head = await fetch(`${context.origin}/monitor`, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')
    for (const path of ['/login', '/no-existe', '/ruta/anidada', '/login.html', '/login?from=prueba']) {
      const response = await fetch(`${context.origin}${path}`, {
        headers: { accept: 'text/html' }, redirect: 'manual',
      })
      assert.equal(response.status, 302)
      assert.equal(response.headers.get('location'), '/monitor')
      assert.equal(response.headers.get('cache-control'), 'no-store')
    }
    const missingHead = await fetch(`${context.origin}/login`, {
      method: 'HEAD', headers: { accept: 'text/html' }, redirect: 'manual',
    })
    assert.equal(missingHead.status, 302)
    assert.equal(missingHead.headers.get('location'), '/monitor')
    assert.equal(await missingHead.text(), '')
    const followed = await fetch(`${context.origin}/login`, { headers: { accept: 'text/html' } })
    assert.equal(followed.status, 200)
    assert.equal(followed.url, `${context.origin}/monitor`)
    assert.match(await followed.text(), /<title>Voltio<\/title>/)
    for (const path of ['/assets/missing.js', '/assets/no-existe', '/fonts/missing.woff2', '/api/no-existe', '/ws/no-existe']) {
      const response = await fetch(`${context.origin}${path}`, { headers: { accept: 'text/html' } })
      assert.equal(response.status, 404)
      assert.doesNotMatch(await response.text(), /<title>Voltio<\/title>/)
    }
  } finally {
    await context.close()
  }
})
