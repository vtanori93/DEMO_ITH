import { WebSocket, WebSocketServer } from 'ws'
import { RELIABILITY } from '../src/shared/contracts/reliability.ts'

const port = Number(process.env.MOCK_ESP32_PORT || 8080)
const server = new WebSocketServer({ host: '127.0.0.1', port, path: '/ws' })
const start = Date.now()
server.on('listening', () =>
  console.log(`ESP32 de prueba: ws://127.0.0.1:${port}/ws (datos simulados, 1 Hz)`),
)
server.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
server.on('connection', (socket) => {
  const timer = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) return
    const t = (Date.now() - start) / 1_000
    socket.send(
      JSON.stringify({
        temperature: 25 + 15 * Math.sin(t * 0.15),
        voltage: 10.5 + Math.sin(t * 0.6 + 1),
        current: 24 + 12 * Math.sin(t * 0.3 + 2),
      }),
    )
  }, RELIABILITY.sampleIntervalMs)
  socket.once('close', () => clearInterval(timer))
})
function shutdown() {
  for (const socket of server.clients) socket.terminate()
  server.close()
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
