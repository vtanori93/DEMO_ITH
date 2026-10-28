import { MEASUREMENT_UNIT_NAMES } from '../contracts/measurements.ts'
import type { MeasurementUnit } from '../contracts/measurements.ts'

export type NumericInput = number | null | undefined
export type DecimalPlaces = 0 | 1 | 2 | 3 | 4

const integers = new Intl.NumberFormat('es', { maximumFractionDigits: 0 })

export function decimalPipe(value: NumericInput, places: DecimalPlaces = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(places) : '—'
}

export function integerPipe(value: NumericInput): string {
  return typeof value === 'number' && Number.isFinite(value) ? integers.format(value) : '—'
}

export function measurementPipe(value: NumericInput, unit: MeasurementUnit, format: 'symbol' | 'label' = 'symbol'): string {
  const formatted = decimalPipe(value)
  return formatted === '—' ? formatted : `${formatted} ${format === 'label' ? MEASUREMENT_UNIT_NAMES[unit] : unit}`
}

export function voltagePipe(value: NumericInput, format: 'symbol' | 'label' = 'symbol'): string {
  return measurementPipe(value, 'V', format)
}

