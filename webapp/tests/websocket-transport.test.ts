import { test } from 'node:test'
import type { TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createWebSocketTransport } from '../src/features/telemetry/services/websocket-transport.ts'
import type { WebSocketChannel } from '../src/features/telemetry/services/websocket-transport.ts'
import type { TransportEvent } from '../src/features/telemetry/model/types.ts'
import { GATEWAY_PROTOCOL } from '../src/shared/contracts/gateway.ts'

class TestSocket implements WebSocketChannel {
  readyState = 0
  onopen: WebSocketChannel['onopen'] = null
  onmessage: WebSocketChannel['onmessage'] = null
  onerror: WebSocketChannel['onerror'] = null
  onclose: WebSocketChannel['onclose'] = null
  open() { this.readyState = 1; this.onopen?.(new Event('open')) }
  message(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) })) }
  fail() { this.onerror?.(new Event('error')) }
  close() { this.readyState = 3; this.onclose?.(new CloseEvent('close')) }
}

function fixture(context: TestContext, options: Parameters<typeof createWebSocketTransport>[1] = {}) {
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000 })
  const sockets: TestSocket[] = []
  const events: TransportEvent[] = []
  const lifecycle = new EventTarget()
  const transport = createWebSocketTransport('ws://localhost/ws/monitor', {
    createSocket: () => { const socket = new TestSocket(); sockets.push(socket); return socket },
    random: () => 0.5, lifecycle, ...options,
  })
  const stop = transport.start((event) => events.push(event))
  context.after(stop)
  const socket = (index: number) => { const value = sockets[index]; assert.ok(value); return value }
  return { sockets, events, lifecycle, stop, socket, tick: (ms: number) => context.mock.timers.tick(ms) }
}

await test('reintenta errores sin cierre, cancela intentos anteriores y conserva una sola conexión', (context) => {
  const state = fixture(context)
  const first = state.socket(0)
  first.open()
  const lateMessage = first.onmessage
  const lateClose = first.onclose
  first.fail()
  lateClose?.(new CloseEvent('close'))
  state.tick(1_000)
  assert.equal(state.sockets.length, 2)
  state.socket(1).open()
  lateMessage?.(new MessageEvent('message', { data: '{"temperature":5,"voltage":5,"current":5}' }))
  assert.equal(state.events.filter((event) => event.type === 'message').length, 0)
  assert.equal(first.readyState, 3)
})

await test('un handshake que nunca responde termina por timeout y vuelve a intentarse', (context) => {
  const state = fixture(context)
  state.tick(8_000)
  assert.equal(state.socket(0).readyState, 3)
  state.tick(1_000)
  assert.equal(state.sockets.length, 2)
  state.socket(1).open()
  assert.ok(state.events.some((event) => event.type === 'status' && event.status === 'connected'))
})

await test('detecta conexiones silenciosas y el heartbeat no cuenta como lectura', (context) => {
  const state = fixture(context)
  state.socket(0).open()
  state.tick(14_000)
  state.socket(0).message({ protocol: GATEWAY_PROTOCOL, type: 'heartbeat' })
  state.tick(14_000)
  assert.equal(state.sockets.length, 1)
  assert.equal(state.events.filter((event) => event.type === 'message').length, 0)
  state.tick(1_000)
  assert.equal(state.socket(0).readyState, 3)
  state.tick(1_000)
  assert.equal(state.sockets.length, 2)
})

await test('recupera inmediatamente al volver la red y desconectar cancela todos los reintentos', (context) => {
  const state = fixture(context)
  state.socket(0).fail()
  state.lifecycle.dispatchEvent(new Event('online'))
  assert.equal(state.sockets.length, 2)
  state.stop()
  state.lifecycle.dispatchEvent(new Event('online'))
  state.lifecycle.dispatchEvent(new Event('focus'))
  state.tick(60_000)
  assert.equal(state.sockets.length, 2)
})

await test('deduplica la muestra recuperada tras reconectar y admite un reinicio del servidor', (context) => {
  const state = fixture(context)
  const sample = { protocol: GATEWAY_PROTOCOL, type: 'sample', streamId: 'servidor-a', sequence: 1,
    ageMs: 0, values: { temperature: 1.25, voltage: 2.5, current: 3.75 } }
  state.socket(0).open()
  state.socket(0).message(sample)
  state.socket(0).fail()
  state.tick(1_000)
  state.socket(1).open()
  state.socket(1).message({ ...sample, ageMs: 1_000 })
  assert.equal(state.events.filter((event) => event.type === 'message').length, 1)
  state.socket(1).message({ ...sample, sequence: 2 })
  state.socket(1).message({ ...sample, streamId: 'servidor-b' })
  assert.equal(state.events.filter((event) => event.type === 'message').length, 3)
})

await test('los errores del constructor no detienen los reintentos', (context) => {
  let attempts = 0
  const state = fixture(context, { createSocket: () => { attempts++; throw new Error('Sin red') } })
  for (let index = 0; index < 10; index++) state.tick(5_000)
  assert.ok(attempts >= 10)
  assert.ok(state.events.some((event) => event.type === 'status' && event.status === 'reconnecting'))
})
