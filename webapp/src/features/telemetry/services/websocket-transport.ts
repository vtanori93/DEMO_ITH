import type { TelemetryTransport, TransportEvent } from '../model/types.ts'
import { GATEWAY_PROTOCOL } from '../../../shared/contracts/gateway.ts'
import { RELIABILITY } from '../../../shared/contracts/reliability.ts'
import { isRecord } from '../../../shared/lib/guards.ts'
import { parseTelemetry } from '../domain/telemetry.ts'

export interface WebSocketChannel {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  close: () => void
}

interface TransportOptions {
  createSocket?: (endpoint: string) => WebSocketChannel
  handshakeTimeoutMs?: number
  activityTimeoutMs?: number
  retryBaseMs?: number
  retryMaxMs?: number
  random?: () => number
  lifecycle?: EventTarget
}

export function createWebSocketTransport(endpoint: string, options: TransportOptions = {}): TelemetryTransport {
  const createSocket = options.createSocket ?? ((url: string) => new WebSocket(url))
  const handshakeTimeoutMs = options.handshakeTimeoutMs ?? RELIABILITY.handshakeTimeoutMs
  const activityTimeoutMs = options.activityTimeoutMs ?? RELIABILITY.activityTimeoutMs
  const retryBaseMs = options.retryBaseMs ?? RELIABILITY.retryBaseMs
  const retryMaxMs = options.retryMaxMs ?? RELIABILITY.retryMaxMs
  const random = options.random ?? Math.random
  const lifecycle = options.lifecycle ?? (typeof window === 'undefined' ? null : window)
  return {
    start(receive: (event: TransportEvent) => void) {
      let disposed = false
      let socket: WebSocketChannel | null = null
      let retries = 0
      let openedAt = 0
      let lastActivity = Date.now()
      let lastSample: { streamId: string; sequence: number } | null = null
      let retryTimer: ReturnType<typeof setTimeout> | undefined
      let connectionTimer: ReturnType<typeof setTimeout> | undefined

      function release() {
        clearTimeout(connectionTimer)
        const previous = socket
        socket = null
        if (!previous) return
        previous.onopen = previous.onmessage = previous.onerror = previous.onclose = null
        try { previous.close() } catch { /* El intento ya está cancelado. */ }
      }

      function recover(reason: string) {
        if (disposed || retryTimer !== undefined) return
        release()
        const delay = Math.min(retryMaxMs, Math.round(
          Math.min(retryBaseMs * 2 ** Math.min(retries++, 4), retryMaxMs) * (0.8 + random() * 0.4),
        ))
        receive({ type: 'status', status: 'reconnecting', error: `${reason} Reintentando automáticamente…` })
        retryTimer = setTimeout(() => {
          retryTimer = undefined
          open()
        }, delay)
      }

      function open() {
        if (disposed) return
        receive({ type: 'status', status: retries ? 'reconnecting' : 'connecting' })
        let current: WebSocketChannel
        try { current = createSocket(endpoint) }
        catch { recover('No se pudo abrir la conexión con el receptor.'); return }
        socket = current
        const active = () => !disposed && socket === current
        connectionTimer = setTimeout(() => {
          if (active()) recover('El receptor no respondió a tiempo.')
        }, handshakeTimeoutMs)
        current.onopen = () => {
          if (!active()) return
          clearTimeout(connectionTimer)
          openedAt = lastActivity = Date.now()
          receive({ type: 'status', status: 'connected' })
        }
        current.onmessage = (event) => {
          if (!active()) return
          lastActivity = Date.now()
          if (lastActivity - openedAt >= RELIABILITY.stableConnectionMs) retries = 0
          if (typeof event.data === 'string') {
            try {
              const frame: unknown = JSON.parse(event.data)
              if (isRecord(frame) && frame.protocol === GATEWAY_PROTOCOL) {
                if (frame.type === 'heartbeat') return
                if (frame.type === 'sample' && typeof frame.ageMs === 'number' &&
                    Number.isFinite(frame.ageMs) && frame.ageMs >= 0) {
                  const payload = JSON.stringify(frame.values)
                  if (typeof payload !== 'string') throw new Error('Muestra incompleta.')
                  parseTelemetry(payload)
                  if (typeof frame.streamId === 'string' && typeof frame.sequence === 'number' &&
                      Number.isSafeInteger(frame.sequence) && frame.sequence >= 0) {
                    if (lastSample?.streamId === frame.streamId && frame.sequence <= lastSample.sequence) return
                    lastSample = { streamId: frame.streamId, sequence: frame.sequence }
                  }
                  receive({ type: 'message', payload,
                    receivedAt: Math.max(0, Date.now() - frame.ageMs) })
                  return
                }
                if (frame.type === 'rejected' && typeof frame.message === 'string') {
                  receive({ type: 'rejected', message: frame.message })
                  return
                }
              }
            } catch { /* El validador de telemetría informa de un JSON incorrecto. */ }
          }
          receive({ type: 'message', payload: event.data })
        }
        current.onerror = () => { if (active()) recover('Se perdió la comunicación con el receptor.') }
        current.onclose = () => { if (active()) recover('La conexión se interrumpió.') }
      }

      function resume() {
        if (disposed) return
        if (socket?.readyState === 1 && Date.now() - lastActivity < activityTimeoutMs) return
        clearTimeout(retryTimer)
        retryTimer = undefined
        release()
        open()
      }
      function offline() { recover('No hay conexión de red.') }
      function visible() { if (document.visibilityState === 'visible') resume() }
      const watchdog = setInterval(() => {
        if (socket?.readyState === 1 && Date.now() - lastActivity >= activityTimeoutMs)
          recover('La conexión dejó de responder.')
      }, Math.min(RELIABILITY.sampleIntervalMs, activityTimeoutMs))
      lifecycle?.addEventListener('online', resume)
      lifecycle?.addEventListener('offline', offline)
      lifecycle?.addEventListener('focus', resume)
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible)
      open()
      return () => {
        disposed = true
        clearTimeout(retryTimer)
        clearInterval(watchdog)
        lifecycle?.removeEventListener('online', resume)
        lifecycle?.removeEventListener('offline', offline)
        lifecycle?.removeEventListener('focus', resume)
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible)
        release()
      }
    },
  }
}
