import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decimalPipe, durationPipe, integerPipe, jsonPipe, timePipe, voltagePipe, measurementPipe } from '../src/shared/pipes/index.ts'

await test('los pipes muestran voltajes y contadores sin confundir ausencia de datos con cero', () => {
  assert.equal(decimalPipe(0), '0.00')
  assert.equal(decimalPipe(5), '5.00')
  assert.equal(decimalPipe(1.256), '1.26')
  assert.equal(decimalPipe(12.5, 1), '12.5')
  assert.equal(decimalPipe(-12.3456), '-12.35')
  assert.equal(decimalPipe(-12.3456, 4), '-12.3456')
  assert.equal(decimalPipe(0.0001, 4), '0.0001')
  assert.equal(voltagePipe(2.5), '2.50 V')
  assert.equal(voltagePipe(2.5, 'label'), '2.50 voltios')
  assert.equal(measurementPipe(-30, '°C'), '-30.00 °C')
  assert.equal(measurementPipe(100, '°C', 'label'), '100.00 grados Celsius')
  assert.equal(measurementPipe(50, 'A', 'label'), '50.00 amperios')
  assert.equal(integerPipe(1234567), '1.234.567')
  for (const missing of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(decimalPipe(missing), '—')
    assert.equal(voltagePipe(missing), '—')
    assert.equal(integerPipe(missing), '—')
  }
})

await test('los pipes de tiempo admiten sesiones largas, cero y datos ausentes', () => {
  assert.equal(durationPipe(0), '00:00:00')
  assert.equal(durationPipe(-1000), '00:00:00')
  assert.equal(durationPipe(3661999), '01:01:01')
  assert.equal(durationPipe(25 * 3600000), '25:00:00')
  assert.equal(durationPipe(null), '00:00:00')
  assert.equal(timePipe(Date.UTC(2026, 0, 1, 12, 34, 56), 'UTC'), '12:34:56')
  assert.equal(timePipe(0, 'UTC'), '00:00:00')
  for (const missing of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, 1e20])
    assert.equal(timePipe(missing), '—')
})

await test('el pipe JSON conserva números y permite presentación compacta o legible', () => {
  const sample = { temperature: 1.25, voltage: 2.5, current: 3.75 }
  assert.equal(jsonPipe(sample, 0), '{"temperature":1.25,"voltage":2.5,"current":3.75}')
  assert.match(jsonPipe(sample), /\n  "temperature": 1\.25,/)
  assert.equal(jsonPipe(undefined), '—')
  assert.equal(jsonPipe(1n), '—')
  const circular: { self?: unknown } = {}
  circular.self = circular
  assert.equal(jsonPipe(circular), '—')
})
