import type { TelemetryTransport } from '../model/types'
import { RELIABILITY } from '../../../shared/contracts/reliability'

export function createDemoTransport(): TelemetryTransport {
  return {
    start(receive) {
      const start = Date.now()
      receive({ type: 'status', status: 'demo' })
      function tick() {
        const t = (Date.now() - start) / 1_000
        receive({
          type: 'message',
          payload: JSON.stringify({
            temperature: 25 + 12 * Math.sin(t * 0.15) + 0.4 * Math.sin(t * 0.8),
            voltage: 10.8 + 0.7 * Math.sin(t * 0.4 + 1.2) + 0.08 * Math.cos(t * 2),
            current: 24 + 9 * Math.sin(t * 0.25 + 2.8) + 0.6 * Math.sin(t * 1.2),
          }),
        })
      }
      tick()
      const timer = setInterval(tick, RELIABILITY.sampleIntervalMs)
      return () => clearInterval(timer)
    },
  }
}
