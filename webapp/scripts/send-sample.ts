import { WebSocket } from 'ws'
import { parseTelemetry } from '../src/features/telemetry/domain/telemetry.ts'
import { RELIABILITY } from '../src/shared/contracts/reliability.ts'
import { websocketText } from '../server/websocket-data.ts'
import { EXAMPLE_READINGS } from '../src/shared/contracts/measurements.ts'

const [address, ...numbers] = process.argv.slice(2)
if (!address || (numbers.length !== 0 && numbers.length !== 3)) {
  console.error('Uso: npm run send:sample -- "URL_COPIADA_DE_LA_WEBAPP" [temperatura_C voltaje_V corriente_A]')
  process.exit(1)
}
let url: URL
try {
  url = new URL(address)
  if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error()
} catch {
  console.error('Introduce una dirección ws:// o wss:// válida.')
  process.exit(1)
}
const [temperature, voltage, current] = numbers.length ? numbers.map(Number) : EXAMPLE_READINGS
const payload = JSON.stringify({ temperature, voltage, current })
try { parseTelemetry(payload) }
catch (error) {
  console.error(error instanceof Error ? error.message : 'Valores no válidos.')
  process.exit(1)
}

let socket: WebSocket | null = null
let sending: ReturnType<typeof setInterval> | undefined
let retry: ReturnType<typeof setTimeout> | undefined
let stopped = false
let attempts = 0
function connect() {
  if (stopped) return
  const current = new WebSocket(url, { handshakeTimeout: RELIABILITY.handshakeTimeoutMs })
  socket = current
  current.on('open', () => {
    attempts = 0
    console.log('Emisor conectado. Publicando valores de prueba a 1 Hz; Ctrl+C para terminar.')
    const send = () => {
      if (current.readyState === WebSocket.OPEN)
        current.send(payload, (error) => { if (error) current.terminate() })
    }
    send()
    sending = setInterval(send, RELIABILITY.sampleIntervalMs)
  })
  current.on('message', (data) => console.log(`Respuesta del receptor: ${websocketText(data)}`))
  current.on('error', (error) => { console.warn(`Conexión interrumpida: ${error.message}`); current.terminate() })
  current.on('close', () => {
    clearInterval(sending)
    if (socket === current) socket = null
    if (!stopped) {
      const delay = Math.min(RELIABILITY.retryMaxMs, RELIABILITY.retryBaseMs * 2 ** Math.min(attempts++, 3))
      retry = setTimeout(connect, delay)
    }
  })
}
const stop = () => {
  stopped = true
  clearTimeout(retry)
  clearInterval(sending)
  const current = socket
  if (current) {
    current.close()
    const timeout = setTimeout(() => current.terminate(), 2_000)
    timeout.unref()
  }
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
connect()
