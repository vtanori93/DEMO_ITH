import { CHANNELS } from '../../../shared/contracts/measurements.ts'
import type { MeasurementChannel, MeasurementKey } from '../../../shared/contracts/measurements.ts'
import type { DecimalPlaces } from '../../../shared/pipes/number.pipe.ts'
import { isRecord } from '../../../shared/lib/guards.ts'

export const INDICATOR_STORAGE_KEY = 'voltio.indicators.v1'
export const INDICATOR_STYLES = [
  { value: 'arc', label: 'Arco', icon: 'gauge' },
  { value: 'ring', label: 'Anillo', icon: 'ring' },
  { value: 'bar', label: 'Barra', icon: 'bar' },
  { value: 'digital', label: 'Digital', icon: 'digits' },
] as const
export const ACCENT_COLORS = ['#619a25', '#4981d9', '#dc8b46', '#9664cf', '#168b89', '#ce526b'] as const
export type IndicatorStyle = (typeof INDICATOR_STYLES)[number]['value']
export interface IndicatorSettings {
  name: string
  color: string
  style: IndicatorStyle
  decimals: DecimalPlaces
  thickness: number
  valueSize: 'normal' | 'large'
  showScale: boolean
  showTicks: boolean
  showExtrema: boolean
  animated: boolean
  thresholds: { enabled: boolean; lower: number; upper: number }
}
export type IndicatorSettingsMap = Record<MeasurementKey, IndicatorSettings>

export function defaultIndicator(channel: MeasurementChannel): IndicatorSettings {
  return {
    name: channel.name, color: channel.color, style: 'arc', decimals: 2, thickness: 11,
    valueSize: 'normal', showScale: true, showTicks: true, showExtrema: true, animated: true,
    thresholds: { enabled: false, lower: channel.minimum, upper: channel.maximum },
  }
}
export function defaultIndicators(): IndicatorSettingsMap {
  return {
    temperature: defaultIndicator(CHANNELS[0]),
    voltage: defaultIndicator(CHANNELS[1]),
    current: defaultIndicator(CHANNELS[2]),
  }
}
export function validateIndicator(value: unknown, channel: MeasurementChannel): value is IndicatorSettings {
  if (!isRecord(value) || !isRecord(value.thresholds)) return false
  return typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 40
    && typeof value.color === 'string' && /^#[a-f\d]{6}$/i.test(value.color)
    && INDICATOR_STYLES.some(({ value: style }) => style === value.style)
    && typeof value.decimals === 'number' && Number.isInteger(value.decimals) && value.decimals >= 0 && value.decimals <= 4
    && typeof value.thickness === 'number' && Number.isInteger(value.thickness) && value.thickness >= 6 && value.thickness <= 20
    && (value.valueSize === 'normal' || value.valueSize === 'large')
    && ['showScale', 'showTicks', 'showExtrema', 'animated'].every((key) => typeof value[key] === 'boolean')
    && typeof value.thresholds.enabled === 'boolean'
    && typeof value.thresholds.lower === 'number' && Number.isFinite(value.thresholds.lower)
    && typeof value.thresholds.upper === 'number' && Number.isFinite(value.thresholds.upper)
    && value.thresholds.lower >= channel.minimum && value.thresholds.upper <= channel.maximum
    && value.thresholds.lower < value.thresholds.upper
}
export function parseIndicatorSettings(raw: string | null): IndicatorSettingsMap {
  const defaults = defaultIndicators()
  if (!raw || raw.length > 16_384) return defaults
  try {
    const data: unknown = JSON.parse(raw)
    if (!isRecord(data) || data.version !== 1 || !isRecord(data.indicators)) return defaults
    for (const channel of CHANNELS) {
      const item = data.indicators[channel.key]
      if (validateIndicator(item, channel)) defaults[channel.key] = { ...item, name: item.name.trim(), thresholds: { ...item.thresholds } }
    }
  } catch { /* Una preferencia dañada no impide recibir datos. */ }
  return defaults
}
export function serializeIndicatorSettings(indicators: IndicatorSettingsMap): string {
  return JSON.stringify({ version: 1, indicators })
}
export function thresholdState(value: number | null, settings: IndicatorSettings): 'low' | 'high' | 'normal' {
  if (value === null || !Number.isFinite(value) || !settings.thresholds.enabled) return 'normal'
  if (value < settings.thresholds.lower) return 'low'
  if (value > settings.thresholds.upper) return 'high'
  return 'normal'
}
