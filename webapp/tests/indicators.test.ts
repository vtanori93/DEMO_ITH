import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHANNELS } from '../src/shared/contracts/measurements.ts'
import { defaultIndicators, parseIndicatorSettings, serializeIndicatorSettings, thresholdState, validateIndicator } from '../src/features/indicators/domain/indicator-settings.ts'

await test('las preferencias válidas conservan opciones independientes y los rangos físicos', () => {
  const settings = defaultIndicators()
  settings.temperature = { ...settings.temperature, name: 'Motor', color: '#9664cf', style: 'ring', decimals: 4, thresholds: { enabled: true, lower: -10, upper: 80 } }
  settings.voltage = { ...settings.voltage, style: 'bar', showExtrema: false }
  const restored = parseIndicatorSettings(serializeIndicatorSettings(settings))
  assert.deepEqual(restored, settings)
  assert.equal(CHANNELS[0].minimum, -30)
  assert.equal(CHANNELS[0].maximum, 100)
  assert.equal(CHANNELS[1].maximum, 12)
  assert.equal(CHANNELS[2].maximum, 50)
})

await test('las preferencias dañadas o de otra versión se recuperan sin perder los otros indicadores', () => {
  const defaults = defaultIndicators()
  for (const raw of [null, '{', 'null', '[]', JSON.stringify({ version: 2, indicators: defaults }), 'x'.repeat(20_000)])
    assert.deepEqual(parseIndicatorSettings(raw), defaults)
  const restored = parseIndicatorSettings(JSON.stringify({ version: 1, indicators: {
    temperature: { ...defaults.temperature, color: 'url(javascript:alert(1))' },
    voltage: { ...defaults.voltage, name: 'Batería', style: 'digital' },
    current: { ...defaults.current, decimals: 100 },
  } }))
  assert.deepEqual(restored.temperature, defaults.temperature)
  assert.equal(restored.voltage.name, 'Batería')
  assert.equal(restored.voltage.style, 'digital')
  assert.deepEqual(restored.current, defaults.current)
})

await test('la validación rechaza umbrales vacíos, invertidos o fuera del rango de cada variable', () => {
  const defaults = defaultIndicators()
  for (const channel of CHANNELS) {
    const settings = defaults[channel.key]
    assert.equal(validateIndicator(settings, channel), true)
    for (const thresholds of [
      { enabled: true, lower: channel.maximum, upper: channel.minimum },
      { enabled: true, lower: 0, upper: 0 },
      { enabled: true, lower: channel.minimum - 1, upper: channel.maximum },
      { enabled: true, lower: channel.minimum, upper: channel.maximum + 1 },
      { enabled: true, lower: Number.NaN, upper: channel.maximum },
      { enabled: true, lower: channel.minimum, upper: Number.POSITIVE_INFINITY },
    ]) assert.equal(validateIndicator({ ...settings, thresholds }, channel), false)
    for (const patch of [{ name: ' ' }, { name: 'x'.repeat(41) }, { thickness: 50 }, { decimals: 1.5 }, { showScale: 'false' }, { style: 'unknown' }])
      assert.equal(validateIndicator({ ...settings, ...patch }, channel), false)
  }
})

await test('los avisos respetan los límites incluidos y nunca convierten ausencia de datos en una alarma', () => {
  const settings = defaultIndicators().temperature
  settings.thresholds = { enabled: true, lower: -5, upper: 60 }
  assert.equal(thresholdState(-5.01, settings), 'low')
  assert.equal(thresholdState(60.01, settings), 'high')
  for (const value of [-5, 0, 60, null, Number.NaN]) assert.equal(thresholdState(value, settings), 'normal')
  settings.thresholds.enabled = false
  assert.equal(thresholdState(100, settings), 'normal')
})
