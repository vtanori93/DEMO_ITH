import { isRecord } from '../lib/guards.ts'
import type { MeasurementValues } from './measurements.ts'

export const GATEWAY_MONITOR_PATH = '/ws/monitor'
export const GATEWAY_API_PATH = '/api/gateway'
export const GATEWAY_PROTOCOL = 'voltio.gateway.v2'

export interface GatewayConfig {
  senderPath: string
  deviceId: string
  publicOrigin: string
  enabled: boolean
}
export interface GatewayStatus {
  config: GatewayConfig
  deviceConnected: boolean
  monitorCount: number
  received: number
  rejected: number
  lastMessageAt: number | null
  lastError: string | null
  configWarning: string | null
  detectedPublicOrigin: string | null
  environmentPublicOrigin: string | null
  lanAddresses: string[]
}
export interface GatewaySampleFrame {
  protocol: typeof GATEWAY_PROTOCOL
  type: 'sample'
  ageMs: number
  streamId: string
  sequence: number
  values: MeasurementValues
}
export interface GatewayRejectedFrame {
  protocol: typeof GATEWAY_PROTOCOL
  type: 'rejected'
  message: string
}

export interface GatewayHeartbeatFrame {
  protocol: typeof GATEWAY_PROTOCOL
  type: 'heartbeat'
}

export type GatewayFrame = GatewaySampleFrame | GatewayRejectedFrame | GatewayHeartbeatFrame

export function parseGatewayStatus(value: unknown): GatewayStatus {
  if (!isRecord(value) || !isRecord(value.config))
    throw new Error('El estado del receptor no es válido.')
  const config = value.config
  if (
    typeof config.senderPath !== 'string' ||
    typeof config.deviceId !== 'string' ||
    typeof config.publicOrigin !== 'string' ||
    typeof config.enabled !== 'boolean' ||
    typeof value.deviceConnected !== 'boolean' ||
    !isCounter(value.monitorCount) ||
    !isCounter(value.received) ||
    !isCounter(value.rejected) ||
    !(value.lastMessageAt === null || isCounter(value.lastMessageAt)) ||
    !(value.lastError === null || typeof value.lastError === 'string') ||
    !(value.configWarning === undefined || value.configWarning === null || typeof value.configWarning === 'string') ||
    !(value.detectedPublicOrigin === undefined || value.detectedPublicOrigin === null || isPublicHttpsOrigin(value.detectedPublicOrigin)) ||
    !(value.environmentPublicOrigin === undefined || value.environmentPublicOrigin === null || isPublicHttpsOrigin(value.environmentPublicOrigin)) ||
    !isStringArray(value.lanAddresses)
  )
    throw new Error('El estado del receptor no coincide con el contrato esperado.')
  return {
    config: {
      senderPath: config.senderPath,
      deviceId: config.deviceId,
      publicOrigin: config.publicOrigin,
      enabled: config.enabled,
    },
    deviceConnected: value.deviceConnected,
    monitorCount: value.monitorCount,
    received: value.received,
    rejected: value.rejected,
    lastMessageAt: value.lastMessageAt,
    lastError: value.lastError,
    configWarning: value.configWarning ?? null,
    detectedPublicOrigin: value.detectedPublicOrigin ?? null,
    environmentPublicOrigin: value.environmentPublicOrigin ?? null,
    lanAddresses: value.lanAddresses,
  }
}

function isCounter(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function isPublicHttpsOrigin(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password &&
      url.pathname === '/' && !url.search && !url.hash
  } catch { return false }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string')
}

/** .env tiene prioridad; el origen se recibe del servidor para evitar recompilar React. */
export function gatewaySenderUrl(status: GatewayStatus, pageOrigin: string): string {
  return senderUrl(
    { ...status.config, publicOrigin: status.environmentPublicOrigin || status.config.publicOrigin },
    pageOrigin,
    status.lanAddresses,
    status.detectedPublicOrigin,
  )
}

export function senderUrl(
  config: GatewayConfig,
  pageOrigin: string,
  lanAddresses: string[] = [],
  detectedPublicOrigin: string | null = null,
): string {
  const page = new URL(pageOrigin)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(page.hostname) ||
    lanAddresses.includes(page.hostname) || page.hostname.endsWith('.local')
  const origin = new URL(config.publicOrigin || (local && detectedPublicOrigin) || pageOrigin)
  if (
    !config.publicOrigin &&
    origin.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) &&
    lanAddresses[0]
  )
    origin.hostname = lanAddresses[0]
  origin.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:'
  origin.pathname = config.senderPath
  origin.search = ''
  origin.searchParams.set('device', config.deviceId)
  return origin.href
}

