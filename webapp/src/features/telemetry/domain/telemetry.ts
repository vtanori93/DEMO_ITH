import { isRecord } from '../../../shared/lib/guards.ts'
import { CHANNELS } from '../../../shared/contracts/measurements.ts'
import type { Readings, MeasurementChannel } from '../../../shared/contracts/measurements.ts'
export { CHANNELS } from '../../../shared/contracts/measurements.ts'
export type { Readings, ChannelIndex } from '../../../shared/contracts/measurements.ts'

export interface Sample {
  timestamp: number
  values: Readings
}
export const HISTORY_MS = 120_000
export const MAX_SAMPLES = 1_200

export function measurementRatio(value: number, channel: MeasurementChannel): number {
  return (value - channel.minimum) / (channel.maximum - channel.minimum)
}

export function parseTelemetry(payload: string): Readings {
  if (payload.length > 4_096) throw new Error('El mensaje supera los 4096 caracteres.')
  let data: unknown
  try {
    data = JSON.parse(payload)
  } catch {
    throw new Error('El mensaje recibido no es JSON válido.')
  }
  if (!isRecord(data))
    throw new Error('Se espera un objeto JSON con temperature, voltage y current.')
  const object = data
  function readMeasurement(channel: MeasurementChannel): number {
    const value = object[channel.key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < channel.minimum || value > channel.maximum)
      throw new Error(`${channel.name} (${channel.key}) debe ser un número finito entre ${channel.minimum} y ${channel.maximum} ${channel.unit}; se admiten decimales.`)
    return value
  }
  return [readMeasurement(CHANNELS[0]), readMeasurement(CHANNELS[1]), readMeasurement(CHANNELS[2])]
}

export function validateEndpoint(
  input: string,
  pageProtocol = 'http:',
  pageOrigin?: string,
): string {
  let url: URL
  try {
    const endpoint = input.trim()
    if (endpoint.startsWith('/') && !endpoint.startsWith('//') && pageOrigin) {
      url = new URL(endpoint, pageOrigin)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Origen no válido.')
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    } else {
      url = new URL(endpoint)
    }
  } catch {
    throw new Error('Introduce una dirección válida, por ejemplo ws://192.168.4.1/ws.')
  }
  if (!['ws:', 'wss:'].includes(url.protocol) || !url.hostname || url.hash)
    throw new Error('La dirección debe comenzar por ws:// o wss:// y no incluir #.')
  if (url.username || url.password) throw new Error('La dirección no debe incluir credenciales.')
  if (pageProtocol === 'https:' && url.protocol === 'ws:')
    throw new Error(
      'Esta página usa HTTPS. Usa /ws/monitor para el receptor de la aplicación, o una dirección wss://.',
    )
  return url.href
}

export function appendSample(samples: Sample[], sample: Sample): Sample[] {
  return [
    ...samples.filter(({ timestamp }) => timestamp >= sample.timestamp - HISTORY_MS),
    sample,
  ].slice(-MAX_SAMPLES)
}
export function samplesToCsv(samples: readonly Sample[]): string {
  return (
    `\uFEFFfecha_iso,${CHANNELS.map(({ csvHeader }) => csvHeader).join(',')}\r\n` +
    samples
      .map(
        ({ timestamp, values }) =>
          `${new Date(timestamp).toISOString()},${values.map((value) => value.toFixed(4)).join(',')}`,
      )
      .join('\r\n')
  )
}
