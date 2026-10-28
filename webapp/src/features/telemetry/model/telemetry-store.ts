import { appendSample, parseTelemetry, validateEndpoint } from '../domain/telemetry.ts'
import type { Sample } from '../domain/telemetry.ts'
import { RELIABILITY } from '../../../shared/contracts/reliability.ts'
import type {
  ConnectionState,
  TelemetryDependencies,
  TelemetrySnapshot,
  TransportEvent,
} from './types.ts'

function initialState(endpoint: string): TelemetrySnapshot {
  return {
    endpoint,
    connection: {
      status: 'disconnected',
      source: null,
      startedAt: null,
      stoppedAt: null,
      lastReceivedAt: null,
      stale: false,
      error: null,
      warning: null,
    },
    readings: { values: null, minimum: null, maximum: null },
    samples: [],
    metrics: { received: 0, invalid: 0, rate: 0 },
  }
}

/** El dominio no depende de React ni de una implementación concreta del transporte. */
export function createTelemetryStore(dependencies: TelemetryDependencies) {
  let runtime = initialState(dependencies.endpoint)
  let snapshot = { ...runtime }
  let pending: Sample | null = null
  let dirty = false
  let stopTransport: (() => void) | undefined
  let flushTimer: ReturnType<typeof setInterval> | undefined
  let rateWindow = { timestamp: Date.now(), received: 0 }
  let generation = 0
  const subscribers = new Set<() => void>()

  function publish() {
    snapshot = { ...runtime }
    dirty = false
    subscribers.forEach((subscriber) => subscriber())
  }
  function updateConnection(patch: Partial<ConnectionState>) {
    runtime.connection = { ...runtime.connection, ...patch }
    dirty = true
  }
  function receive(event: TransportEvent) {
    if (event.type === 'status') {
      const active = event.status === 'connected' || event.status === 'demo'
      updateConnection({
        status: event.status,
        error: event.error ?? null,
        stale: runtime.connection.lastReceivedAt !== null &&
          Date.now() - runtime.connection.lastReceivedAt >= RELIABILITY.staleAfterMs,
        ...(active ? { startedAt: runtime.connection.startedAt ?? Date.now() } : {}),
      })
      if (!active) runtime.metrics = { ...runtime.metrics, rate: 0 }
      publish()
      return
    }
    if (event.type === 'rejected') {
      runtime.metrics = { ...runtime.metrics, invalid: runtime.metrics.invalid + 1 }
      updateConnection({ warning: event.message })
      return
    }
    try {
      if (typeof event.payload !== 'string')
        throw new Error('El ESP32 debe enviar mensajes de texto JSON.')
      const values = parseTelemetry(event.payload)
      const { minimum, maximum } = runtime.readings
      runtime.readings = {
        values,
        minimum: minimum
          ? [
              Math.min(minimum[0], values[0]),
              Math.min(minimum[1], values[1]),
              Math.min(minimum[2], values[2]),
            ]
          : values,
        maximum: maximum
          ? [
              Math.max(maximum[0], values[0]),
              Math.max(maximum[1], values[1]),
              Math.max(maximum[2], values[2]),
            ]
          : values,
      }
      runtime.metrics = { ...runtime.metrics, received: runtime.metrics.received + 1 }
      const timestamp = Math.max(0, Math.min(Date.now(), event.receivedAt ?? Date.now()))
      runtime.connection = {
        ...runtime.connection,
        lastReceivedAt: timestamp,
        warning: null,
        stale: runtime.connection.status === 'connected' && Date.now() - timestamp >= RELIABILITY.staleAfterMs,
      }
      pending = { timestamp, values }
    } catch (error) {
      runtime.metrics = { ...runtime.metrics, invalid: runtime.metrics.invalid + 1 }
      updateConnection({ warning: error instanceof Error ? error.message : 'Mensaje no válido.' })
    }
    dirty = true
  }
  function flush() {
    if (pending) {
      runtime.samples = appendSample(runtime.samples, pending)
      pending = null
      dirty = true
    }
    const now = Date.now()
    if (now - rateWindow.timestamp >= 1_000) {
      const rate = ['connected', 'demo'].includes(runtime.connection.status)
        ? ((runtime.metrics.received - rateWindow.received) * 1_000) / (now - rateWindow.timestamp)
        : 0
      if (rate !== runtime.metrics.rate) {
        runtime.metrics = { ...runtime.metrics, rate }
        dirty = true
      }
      rateWindow = { timestamp: now, received: runtime.metrics.received }
    }
    const stale =
      runtime.connection.status === 'connected' &&
      now - (runtime.connection.lastReceivedAt ?? runtime.connection.startedAt ?? now) >= RELIABILITY.staleAfterMs
    if (stale !== runtime.connection.stale) updateConnection({ stale })
    if (dirty) publish()
  }
  function stop() {
    generation++
    stopTransport?.()
    stopTransport = undefined
    pending = null
  }
  function begin(source: 'device' | 'demo', endpoint: string, transportEndpoint = endpoint) {
    stop()
    runtime = initialState(endpoint)
    runtime.connection = {
      ...runtime.connection,
      source,
      status: source === 'demo' ? 'demo' : 'connecting',
    }
    rateWindow = { timestamp: Date.now(), received: 0 }
    publish()
    const currentGeneration = generation
    const transport =
      source === 'demo' ? dependencies.createDemo() : dependencies.createSocket(transportEndpoint)
    stopTransport = transport.start((event) => {
      if (generation === currentGeneration) receive(event)
    })
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (subscriber: () => void) => {
      subscribers.add(subscriber)
      return () => {
        subscribers.delete(subscriber)
      }
    },
    start: () => {
      if (!flushTimer) flushTimer = setInterval(flush, 100)
      return () => {
        stop()
        clearInterval(flushTimer)
        flushTimer = undefined
      }
    },
    setEndpoint: (endpoint: string) => {
      runtime.endpoint = endpoint
      publish()
    },
    connect: () => {
      try {
        const configuredEndpoint = runtime.endpoint.trim()
        const endpoint = validateEndpoint(
          configuredEndpoint,
          dependencies.pageProtocol,
          dependencies.pageOrigin,
        )
        dependencies.saveEndpoint(configuredEndpoint)
        begin('device', configuredEndpoint, endpoint)
        return true
      } catch (error) {
        updateConnection({ error: error instanceof Error ? error.message : 'Dirección no válida.' })
        publish()
        return false
      }
    },
    startDemo: () => begin('demo', runtime.endpoint),
    disconnect: () => {
      flush()
      stop()
      updateConnection({ status: 'disconnected', stoppedAt: Date.now(), stale: false, error: null })
      runtime.metrics = { ...runtime.metrics, rate: 0 }
      publish()
    },
    resetHistory: () => {
      runtime.samples = []
      pending = null
      runtime.readings = {
        ...runtime.readings,
        minimum: runtime.readings.values,
        maximum: runtime.readings.values,
      }
      publish()
    },
  }
}
export type TelemetryStore = ReturnType<typeof createTelemetryStore>
