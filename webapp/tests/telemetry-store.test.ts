import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as wait } from 'node:timers/promises'
import { createTelemetryStore } from '../src/features/telemetry/model/telemetry-store.ts'
import type { TransportEvent } from '../src/features/telemetry/model/types.ts'

function receiver(receivers: Array<(event: TransportEvent) => void>, index: number) {
  const receive = receivers[index]
  assert.ok(receive, `El transporte ${index} debe estar iniciado.`)
  return receive
}

function setup() {
  const receivers: Array<(event: TransportEvent) => void> = []
  let stops = 0
  const transport = () => ({
    start(receive: (event: TransportEvent) => void) {
      receivers.push(receive)
      return () => {
        stops++
      }
    },
  })
  const store = createTelemetryStore({
    endpoint: 'ws://127.0.0.1/ws',
    createSocket: transport,
    createDemo: transport,
    saveEndpoint: () => {},
    pageProtocol: 'http:',
  })
  return { store, receivers, stops: () => stops }
}

await test('lecturas, extremos e historial conservan las fracciones recibidas sin convertirlas a enteros', async () => {
  const { store, receivers } = setup()
  const dispose = store.start()
  try {
    store.connect()
    const receive = receiver(receivers, 0)
    receive({ type: 'message', payload: '{"temperature":-12.3456789,"voltage":11.23456789,"current":8.7654321}' })
    await wait(130)
    receive({ type: 'message', payload: '{"temperature":-0.0001,"voltage":0.0001,"current":49.9999}' })
    await wait(130)
    const { readings, samples } = store.getSnapshot()
    assert.deepEqual(readings.values, [-0.0001, 0.0001, 49.9999])
    assert.deepEqual(readings.minimum, [-12.3456789, 0.0001, 8.7654321])
    assert.deepEqual(readings.maximum, [-0.0001, 11.23456789, 49.9999])
    assert.deepEqual(samples.map((sample) => sample.values), [
      [-12.3456789, 11.23456789, 8.7654321], [-0.0001, 0.0001, 49.9999],
    ])
  } finally { dispose() }
})

await test('cambiar de fuente cierra el transporte anterior e ignora sus mensajes pendientes', async () => {
  const { store, receivers, stops } = setup()
  const dispose = store.start()
  try {
    store.startDemo()
    receiver(receivers, 0)({ type: 'message', payload: '{"temperature":1,"voltage":2,"current":3}' })
    await wait(130)
    const previous = store.getSnapshot()
    assert.deepEqual(previous.readings.values, [1, 2, 3])
    assert.ok(store.connect())
    assert.equal(stops(), 1)
    receiver(receivers, 0)({ type: 'message', payload: '{"temperature":5,"voltage":5,"current":5}' })
    receiver(receivers, 1)({ type: 'status', status: 'connected' })
    receiver(receivers, 1)({ type: 'message', payload: '{"temperature":0,"voltage":2.5,"current":5}' })
    await wait(130)
    assert.deepEqual(store.getSnapshot().readings.values, [0, 2.5, 5])
    assert.equal(store.getSnapshot().metrics.received, 1)
    assert.equal(store.getSnapshot().connection.source, 'device')
    assert.deepEqual(
      previous.readings.values,
      [1, 2, 3],
      'los snapshots anteriores permanecen inmutables',
    )
  } finally {
    dispose()
  }
})

await test('descartar un paquete no modifica lecturas válidas ni los extremos de la sesión', async () => {
  const { store, receivers } = setup()
  const dispose = store.start()
  try {
    store.connect()
    receiver(receivers, 0)({ type: 'status', status: 'connected' })
    receiver(receivers, 0)({ type: 'message', payload: '{"temperature":1,"voltage":2,"current":3}' })
    receiver(receivers, 0)({ type: 'message', payload: '{"temperature":101,"voltage":2,"current":3}' })
    await wait(130)
    assert.deepEqual(store.getSnapshot().readings.maximum, [1, 2, 3])
    assert.equal(store.getSnapshot().metrics.invalid, 1)
    assert.equal(store.getSnapshot().metrics.received, 1)
    const warning = store.getSnapshot().connection.warning
    assert.ok(warning)
    assert.match(warning, /temperature/)
  } finally {
    dispose()
  }
})

await test('desconectar cancela la fuente y conserva la identificación de datos simulados', async () => {
  const { store, receivers, stops } = setup()
  const dispose = store.start()
  try {
    store.startDemo()
    receiver(receivers, 0)({ type: 'message', payload: '{"temperature":1,"voltage":2,"current":3}' })
    store.disconnect()
    const disconnected = store.getSnapshot()
    receiver(receivers, 0)({ type: 'message', payload: '{"temperature":5,"voltage":5,"current":5}' })
    await wait(130)
    assert.equal(stops(), 1)
    assert.equal(disconnected.connection.status, 'disconnected')
    assert.equal(disconnected.connection.source, 'demo')
    assert.deepEqual(store.getSnapshot().readings.values, [1, 2, 3])
    assert.ok(disconnected.connection.stoppedAt)
  } finally {
    dispose()
  }
})
await test('la conexión relativa se conserva en configuración y se resuelve como WSS al transportarla', () => {
  let target = '',
    saved = ''
  const store = createTelemetryStore({
    endpoint: '/ws/monitor',
    pageProtocol: 'https:',
    pageOrigin: 'https://voltio.ngrok-free.dev',
    createSocket: (endpoint) => {
      target = endpoint
      return { start: () => () => {} }
    },
    createDemo: () => ({ start: () => () => {} }),
    saveEndpoint: (endpoint) => {
      saved = endpoint
    },
  })
  const dispose = store.start()
  try {
    assert.ok(store.connect())
    assert.equal(target, 'wss://voltio.ngrok-free.dev/ws/monitor')
    assert.equal(store.getSnapshot().endpoint, '/ws/monitor')
    assert.equal(saved, '/ws/monitor')
  } finally {
    dispose()
  }
})
