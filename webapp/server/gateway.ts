import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { networkInterfaces } from 'node:os'
import { randomUUID } from 'node:crypto'
import { WebSocket, WebSocketServer } from 'ws'
import { parseTelemetry } from '../src/features/telemetry/domain/telemetry.ts'
import {
  GATEWAY_API_PATH,
  GATEWAY_MONITOR_PATH,
  GATEWAY_PROTOCOL,
} from '../src/shared/contracts/gateway.ts'
import type { GatewayFrame, GatewaySampleFrame, GatewayStatus } from '../src/shared/contracts/gateway.ts'
import { loadGatewayConfig, saveGatewayConfig, validateGatewayConfig } from './gateway-config.ts'
import { websocketText } from './websocket-data.ts'
import { GATEWAY_HEALTH_PATH, RELIABILITY } from '../src/shared/contracts/reliability.ts'
import type { GatewayHealth } from '../src/shared/contracts/reliability.ts'
import { readingsToPayload } from '../src/shared/contracts/measurements.ts'

interface GatewayOptions {
  configFile: string | null
  heartbeatIntervalMs?: number
  peerTimeoutMs?: number
  getDetectedPublicOrigin?: () => string | null
  environmentPublicOrigin?: string | null
}

export async function createGateway(options: GatewayOptions) {
  let configWarning: string | null = null
  let config = await loadGatewayConfig(options.configFile, (message) => { configWarning = message })
  const startedAt = Date.now()
  const streamId = randomUUID()
  let sender: WebSocket | null = null
  let latest: { frame: GatewaySampleFrame; timestamp: number } | null = null
  let received = 0,
    rejected = 0
  let lastError: string | null = null
  let closed = false
  let configQueue = Promise.resolve()
  const monitors = new Set<WebSocket>()
  let websocket = socketServer()
  const lastPong = new WeakMap<WebSocket, number>()
  function socketServer(): WebSocketServer {
    const server = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false })
    server.on('error', (error) => {
      lastError = 'El receptor WebSocket sufrió un error. Se aceptarán nuevos intentos.'
      console.error(lastError, error.message)
    })
    server.once('close', () => {
      if (!closed) {
        monitors.clear()
        sender = null
        websocket = socketServer()
      }
    })
    return server
  }

  function getStatus(): GatewayStatus {
    const lanAddresses = [
      ...new Set(
        Object.values(networkInterfaces())
          .flat()
          .flatMap((address) =>
            address && !address.internal && address.family === 'IPv4' ? [address.address] : [],
          ),
      ),
    ]
    return {
      config: { ...config },
      deviceConnected: sender?.readyState === WebSocket.OPEN,
      monitorCount: monitors.size,
      received,
      rejected,
      lastMessageAt: latest?.timestamp ?? null,
      lastError,
      configWarning,
      detectedPublicOrigin: options.getDetectedPublicOrigin?.() ?? null,
      environmentPublicOrigin: options.environmentPublicOrigin ?? null,
      lanAddresses,
    }
  }
  function send(socket: WebSocket, frame: GatewayFrame) {
    if (socket.readyState !== WebSocket.OPEN) return
    if (socket.bufferedAmount > 256_000) {
      socket.close(1013, 'El receptor no procesa los datos a tiempo.')
      return
    }
    try {
      socket.send(JSON.stringify(frame), (error) => { if (error) socket.terminate() })
    } catch {
      socket.terminate()
    }
  }
  function broadcast(frame: GatewayFrame) {
    for (const monitor of monitors) send(monitor, frame)
  }
  function reject(socket: Duplex, status: number, message: string) {
    socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  }
  function upgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
    let url: URL
    try {
      url = new URL(request.url ?? '/', 'http://localhost')
    } catch {
      reject(socket, 400, 'Invalid request')
      return
    }
    const isMonitor = url.pathname === GATEWAY_MONITOR_PATH
    if (!isMonitor && url.pathname !== config.senderPath) return
    socket.on('error', () => socket.destroy())
    if (closed) { reject(socket, 503, 'Receiver restarting'); return }
    if (websocket.clients.size >= 32) {
      reject(socket, 503, 'Capacity reached')
      return
    }
    if (!isMonitor && !config.enabled) {
      reject(socket, 503, 'Receiver disabled')
      return
    }
    if (!isMonitor && url.searchParams.get('device') !== config.deviceId) {
      reject(socket, 403, 'Device identifier mismatch')
      return
    }
    if (!isMonitor && sender && sender.readyState !== WebSocket.OPEN) {
      sender.terminate()
      sender = null
    }
    if (!isMonitor && sender && sender.readyState === WebSocket.OPEN) {
      reject(socket, 409, 'Device already connected')
      return
    }
    try { websocket.handleUpgrade(request, socket, head, (client) => {
      lastPong.set(client, Date.now())
      client.on('pong', () => lastPong.set(client, Date.now()))
      client.on('error', () => client.terminate())
      if (isMonitor) {
        monitors.add(client)
        if (latest)
          send(client, { ...latest.frame, ageMs: Math.max(0, Date.now() - latest.timestamp) })
        client.on('close', () => monitors.delete(client))
        return
      }
      sender = client
      client.on('close', () => {
        if (sender === client) sender = null
      })
      client.on('message', (data, binary) => {
        if (closed || sender !== client) return
        try {
          if (binary) throw new Error('Envía una trama WebSocket de texto JSON.')
          const values = parseTelemetry(websocketText(data))
          const frame: GatewaySampleFrame = {
            protocol: GATEWAY_PROTOCOL,
            type: 'sample',
            ageMs: 0,
            streamId,
            sequence: received + 1,
            values: readingsToPayload(values),
          }
          latest = { frame, timestamp: Date.now() }
          received++
          lastError = null
          broadcast(frame)
        } catch (error) {
          rejected++
          lastError = error instanceof Error ? error.message : 'Mensaje no válido.'
          const frame: GatewayFrame = { protocol: GATEWAY_PROTOCOL, type: 'rejected', message: lastError }
          send(client, frame)
          broadcast(frame)
        }
      })
    }) } catch {
      reject(socket, 503, 'Receiver temporarily unavailable')
    }
  }
  function json(response: ServerResponse, status: number, value: unknown) {
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    response.end(JSON.stringify(value))
  }
  async function middleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
    const path = (request.url ?? '/').split('?')[0]
    if (request.method === 'GET' && path === GATEWAY_HEALTH_PATH) {
      const health: GatewayHealth = {
        status: 'ready', uptimeMs: Date.now() - startedAt,
        expectedIntervalMs: RELIABILITY.sampleIntervalMs, acceptingData: !closed && config.enabled,
      }
      json(response, closed ? 503 : 200, health)
      return
    }
    if (path !== `${GATEWAY_API_PATH}/status` && path !== `${GATEWAY_API_PATH}/config`) {
      next()
      return
    }
    if (request.method === 'GET' && path.endsWith('/status')) {
      json(response, 200, getStatus())
      return
    }
    if (request.method !== 'PUT' || !path.endsWith('/config')) {
      json(response, 405, { error: 'Método no permitido.' })
      return
    }
    if (!request.headers['content-type']?.startsWith('application/json')) {
      json(response, 415, { error: 'Envía application/json.' })
      return
    }
    try {
      let text = ''
      for await (const rawChunk of request) {
        const chunk: unknown = rawChunk
        if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk))
          throw new Error('El cuerpo de la petición no es texto válido.')
        text += chunk.toString()
        if (Buffer.byteLength(text) > 4096) {
          json(response, 413, { error: 'Configuración demasiado grande.' })
          return
        }
      }
      const updated = validateGatewayConfig(JSON.parse(text))
      const operation = configQueue.then(async () => {
        await saveGatewayConfig(options.configFile, updated)
        const changedSource =
          config.deviceId !== updated.deviceId ||
          config.senderPath !== updated.senderPath ||
          config.enabled !== updated.enabled
        config = updated
        configWarning = null
        if (changedSource) {
          const current = sender
          sender = null
          current?.close(1008, 'La configuración del receptor ha cambiado.')
          latest = null
          lastError = null
        }
      })
      configQueue = operation.catch(() => {})
      await operation
      json(response, 200, getStatus())
    } catch (error) {
      json(response, 400, {
        error: error instanceof Error ? error.message : 'Configuración no válida.',
      })
    }
  }
  const heartbeat = setInterval(() => {
    const now = Date.now()
    for (const client of websocket.clients) {
      if (now - (lastPong.get(client) ?? 0) >= (options.peerTimeoutMs ?? RELIABILITY.peerTimeoutMs)) {
        client.terminate()
        continue
      }
      try { client.ping((error: Error | undefined) => { if (error) client.terminate() }) }
      catch { client.terminate() }
    }
    broadcast({ protocol: GATEWAY_PROTOCOL, type: 'heartbeat' })
  }, options.heartbeatIntervalMs ?? RELIABILITY.heartbeatIntervalMs)
  heartbeat.unref()
  function attach(server: {
    on: (event: 'upgrade', listener: typeof upgrade) => unknown
    off: (event: 'upgrade', listener: typeof upgrade) => unknown
  }) {
    server.on('upgrade', upgrade)
    return () => {
      server.off('upgrade', upgrade)
    }
  }
  async function close() {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    for (const client of websocket.clients) client.terminate()
    await new Promise<void>((resolve) => websocket.close(() => resolve()))
    await configQueue
  }
  return { getStatus, middleware, attach, close }
}
