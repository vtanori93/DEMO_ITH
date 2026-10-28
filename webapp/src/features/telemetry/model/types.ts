import type { Readings, Sample } from '../domain/telemetry.ts'

export type ConnectionStatus =
  'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'demo' | 'error'
export interface ConnectionState {
  status: ConnectionStatus
  source: 'device' | 'demo' | null
  startedAt: number | null
  stoppedAt: number | null
  lastReceivedAt: number | null
  stale: boolean
  error: string | null
  warning: string | null
}
export interface TelemetrySnapshot {
  endpoint: string
  connection: ConnectionState
  readings: { values: Readings | null; minimum: Readings | null; maximum: Readings | null }
  samples: Sample[]
  metrics: { received: number; invalid: number; rate: number }
}
export type TransportEvent =
  | { type: 'message'; payload: unknown; receivedAt?: number }
  | { type: 'rejected'; message: string }
  | { type: 'status'; status: ConnectionStatus; error?: string }
export interface TelemetryTransport {
  start: (receive: (event: TransportEvent) => void) => () => void
}
export interface TelemetryDependencies {
  endpoint: string
  createSocket: (endpoint: string) => TelemetryTransport
  createDemo: () => TelemetryTransport
  saveEndpoint: (endpoint: string) => void
  pageProtocol: string
  pageOrigin?: string
}
