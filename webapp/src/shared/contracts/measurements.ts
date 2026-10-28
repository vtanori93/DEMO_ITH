export const MEASUREMENT_UNIT_NAMES = {
  '°C': 'grados Celsius',
  V: 'voltios',
  A: 'amperios',
} as const

export type MeasurementUnit = keyof typeof MEASUREMENT_UNIT_NAMES

export const CHANNELS = [
  {
    index: 0, key: 'temperature', name: 'Temperatura', short: 'TEMP',
    unit: '°C', minimum: -30, maximum: 100, ticks: [-30, 0, 30, 60, 100],
    csvHeader: 'temperature_c', color: '#619a25', valueLabel: 'Temperatura actual',
  },
  {
    index: 1, key: 'voltage', name: 'Voltaje', short: 'VOLT',
    unit: 'V', minimum: 0, maximum: 12, ticks: [0, 3, 6, 9, 12],
    csvHeader: 'voltage_v', color: '#4981d9', valueLabel: 'Voltaje actual',
  },
  {
    index: 2, key: 'current', name: 'Corriente', short: 'AMP',
    unit: 'A', minimum: 0, maximum: 50, ticks: [0, 10, 20, 30, 40, 50],
    csvHeader: 'current_a', color: '#dc8b46', valueLabel: 'Corriente actual',
  },
] as const

export type ChannelIndex = (typeof CHANNELS)[number]['index']
export type MeasurementKey = (typeof CHANNELS)[number]['key']
export type MeasurementChannel = (typeof CHANNELS)[number]
/** Lecturas de punto flotante: number conserva la fracción recibida, sin redondeo del dominio. */
export type MeasurementValues = { [Key in MeasurementKey]: number }
export type Readings = readonly [temperature: number, voltage: number, current: number]

export function readingsToPayload(values: Readings): MeasurementValues {
  return { temperature: values[0], voltage: values[1], current: values[2] }
}

export const EXAMPLE_READINGS: Readings = [-12.3456, 11.2345, 8.7654]
export const EXAMPLE_MEASUREMENTS: MeasurementValues = readingsToPayload(EXAMPLE_READINGS)
