import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { setTimeout as wait } from 'node:timers/promises'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'
import { startSupervisor } from '../server/supervisor.ts'
import { createGateway } from '../server/gateway.ts'
import { DEFAULT_GATEWAY_CONFIG, loadGatewayConfig, saveGatewayConfig } from '../server/gateway-config.ts'
import { fetchJson } from '../src/shared/lib/fetch-json.ts'
import { parseGatewayStatus } from '../src/shared/contracts/gateway.ts'

async function until(check: () => boolean | Promise<boolean>, timeout = 5_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await Promise.resolve().then(check).catch(() => false)) return
    await wait(25)
  }
  throw new Error('El receptor no se recuperó dentro del tiempo de la prueba.')
}

function supervised() {
  return startSupervisor({
    env: { PORT: '0', HOST: '127.0.0.1', VOLTIO_GATEWAY_CONFIG: ':memory:' }, quiet: true,
    restartDelayMs: 20, healthIntervalMs: 100, healthTimeoutMs: 100,
    maxHealthFailures: 2, shutdownTimeoutMs: 100, startupTimeoutMs: 3_000,
  })
}

await test('el supervisor reinicia un servidor caído y el nuevo receptor acepta datos', async () => {
  const supervisor = supervised()
  let sender: WebSocket | null = null
  try {
    await until(() => supervisor.getSnapshot().ready)
    const firstPid = supervisor.getSnapshot().pid
    assert.ok(firstPid)
    process.kill(firstPid, 'SIGKILL')
    await until(() => supervisor.getSnapshot().ready && supervisor.getSnapshot().pid !== firstPid)
    const healthUrl = supervisor.getSnapshot().healthUrl
    assert.ok(healthUrl)
    const origin = new URL(healthUrl).origin
    sender = new WebSocket(`${origin.replace('http:', 'ws:')}/ws/esp32?device=esp32-01`)
    await once(sender, 'open', { signal: AbortSignal.timeout(2_000) })
    sender.send('{"temperature":1,"voltage":2,"current":3}')
    await until(async () => parseGatewayStatus(await (await fetch(`${origin}/api/gateway/status`)).json()).received === 1)
    assert.ok(supervisor.getSnapshot().restarts >= 1)
  } finally {
    sender?.terminate()
    await supervisor.stop()
  }
})

await test('el supervisor sustituye un proceso que está vivo pero dejó de responder', { skip: process.platform === 'win32' }, async () => {
  const supervisor = supervised()
  try {
    await until(() => supervisor.getSnapshot().ready)
    const firstPid = supervisor.getSnapshot().pid
    assert.ok(firstPid)
    process.kill(firstPid, 'SIGSTOP')
    await until(() => supervisor.getSnapshot().ready && supervisor.getSnapshot().pid !== firstPid)
    const url = supervisor.getSnapshot().healthUrl
    assert.ok(url)
    const response = await fetch(url)
    assert.equal(response.status, 200)
  } finally {
    await supervisor.stop()
  }
})

await test('recupera una configuración corrupta desde una copia y conserva el archivo original', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'voltio-recovery-'))
  const file = join(directory, 'gateway.json')
  const expected = { ...DEFAULT_GATEWAY_CONFIG, senderPath: '/ws/laboratorio', deviceId: 'esp32-lab' }
  try {
    await saveGatewayConfig(file, expected)
    await writeFile(file, '{archivo-incompleto')
    const warnings: string[] = []
    assert.deepEqual(await loadGatewayConfig(file, (message) => warnings.push(message)), expected)
    assert.equal(warnings.length, 1)
    assert.equal(await readFile(file, 'utf8'), '{archivo-incompleto')
    await writeFile(`${file}.bak`, '{copia-incompleta')
    assert.deepEqual(await loadGatewayConfig(file, (message) => warnings.push(message)), DEFAULT_GATEWAY_CONFIG)
    assert.equal(warnings.length, 2)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

await test('descarta una conexión fantasma del ESP32 y admite otra sin reiniciar el receptor', async () => {
  const gateway = await createGateway({ configFile: null, heartbeatIntervalMs: 20, peerTimeoutMs: 80 })
  const server = createServer((request, response) => {
    void gateway.middleware(request, response, () => response.end())
  })
  const detach = gateway.attach(server)
  let ghost: WebSocket | null = null
  let healthy: WebSocket | null = null
  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const endpoint = `ws://127.0.0.1:${address.port}/ws/esp32?device=esp32-01`
    ghost = new WebSocket(endpoint, { autoPong: false })
    const closed = once(ghost, 'close', { signal: AbortSignal.timeout(2_000) })
    await once(ghost, 'open')
    await closed
    assert.equal(gateway.getStatus().deviceConnected, false)
    healthy = new WebSocket(endpoint)
    await once(healthy, 'open')
    healthy.send('{"temperature":0,"voltage":2.5,"current":5}')
    await until(() => gateway.getStatus().received === 1)
    await wait(120)
    assert.equal(healthy.readyState, WebSocket.OPEN)
  } finally {
    ghost?.terminate()
    healthy?.terminate()
    detach()
    await gateway.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

await test('una petición que no termina expira y la siguiente puede recuperar el servicio', async () => {
  let requests = 0
  const server = createServer((_request, response) => {
    if (++requests === 1) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.write('{')
      return
    }
    response.setHeader('content-type', 'application/json')
    response.end('{"status":"ready"}')
  })
  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const endpoint = `http://127.0.0.1:${address.port}`
    await assert.rejects(fetchJson(endpoint, {}, 30))
    const { payload } = await fetchJson(endpoint, {}, 1_000)
    assert.deepEqual(payload, { status: 'ready' })
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
