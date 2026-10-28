export const RELIABILITY = {
  sampleIntervalMs: 1_000,
  staleAfterMs: 3_000,
  heartbeatIntervalMs: 5_000,
  peerTimeoutMs: 10_000,
  activityTimeoutMs: 15_000,
  handshakeTimeoutMs: 8_000,
  requestTimeoutMs: 5_000,
  retryBaseMs: 1_000,
  retryMaxMs: 5_000,
  stableConnectionMs: 15_000,
} as const

export const GATEWAY_HEALTH_PATH = '/api/gateway/health'

export interface GatewayHealth {
  status: 'ready'
  uptimeMs: number
  expectedIntervalMs: number
  acceptingData: boolean
}
