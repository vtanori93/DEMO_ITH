import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appendSample,
  MAX_SAMPLES,
  parseTelemetry,
  samplesToCsv,
  validateEndpoint,
  measurementRatio,
  CHANNELS,
} from '../src/features/telemetry/domain/telemetry.ts'
import type { Sample } from '../src/features/telemetry/domain/telemetry.ts'

await test('acepta temperatura negativa y los límites propios de cada variable', () => {
  assert.deepEqual(
    parseTelemetry('{"temperature":-30,"voltage":0,"current":0,"timestamp":42}'),
    [-30, 0, 0],
  )
  assert.deepEqual(parseTelemetry('{"temperature":100,"voltage":12,"current":50}'), [100, 12, 50])
  assert.deepEqual(parseTelemetry('{"temperature":-0.1,"voltage":8.5,"current":25}'), [-0.1, 8.5, 25])
})
await test('acepta fracciones en los tres canales, notación científica y precisión adicional sin redondear', () => {
  assert.deepEqual(
    parseTelemetry('{"temperature":-12.3456789,"voltage":11.23456789,"current":8.7654321}'),
    [-12.3456789, 11.23456789, 8.7654321],
  )
  assert.deepEqual(
    parseTelemetry('{"temperature":-1e-4,"voltage":0.0001,"current":1.2e-8}'),
    [-0.0001, 0.0001, 0.000000012],
  )
  assert.deepEqual(parseTelemetry('{"temperature":25.0,"voltage":12.0,"current":50.0}'), [25, 12, 50])
})
await test('rechaza JSON incorrecto, canales incompletos y datos fuera de rango sin convertir tipos', () => {
  for (const payload of [
    '{',
    'null',
    '[]',
    '42',
    '{}',
    '{"temperature":1,"voltage":2}',
    '{"temperature":"1","voltage":2,"current":3}',
    '{"temperature":-30.1,"voltage":2,"current":3}',
    '{"temperature":100.1,"voltage":2,"current":3}',
    '{"temperature":25,"voltage":-0.1,"current":3}',
    '{"temperature":25,"voltage":12.1,"current":3}',
    '{"temperature":25,"voltage":2,"current":-0.1}',
    '{"temperature":25,"voltage":2,"current":50.1}',
    '{"temperature":25,"voltage":"12","current":50}',
    '{"temperature":-12.3456,"voltage":11.2345,"current":"8.7654"}',
    '{"temperature":"-12,3456","voltage":11.2345,"current":8.7654}',
    '{"temperature":null,"voltage":11.2345,"current":8.7654}',
    '{"temperature":-12.3456,"voltage":true,"current":8.7654}',
    '{"temperature":NaN,"voltage":11.2345,"current":8.7654}',
    '{"temperature":-12.3456,"voltage":Infinity,"current":8.7654}',
    '{"temperature":1e400,"voltage":2,"current":3}',
    ' '.repeat(4_097),
  ]) {
    assert.throws(() => parseTelemetry(payload), Error, payload)
  }
})
await test('cada indicador utiliza su escala y el cero de temperatura no es su límite inferior', () => {
  assert.equal(measurementRatio(-30, CHANNELS[0]), 0)
  assert.equal(measurementRatio(100, CHANNELS[0]), 1)
  assert.equal(measurementRatio(0, CHANNELS[0]), 30 / 130)
  assert.equal(measurementRatio(6, CHANNELS[1]), 0.5)
  assert.equal(measurementRatio(25, CHANNELS[2]), 0.5)
})
await test('valida WebSocket local y seguro, credenciales y contenido mixto', () => {
  assert.equal(validateEndpoint(' ws://192.168.4.1:81/ws '), 'ws://192.168.4.1:81/ws')
  assert.equal(validateEndpoint('wss://esp32.example/ws', 'https:'), 'wss://esp32.example/ws')
  for (const url of [
    '',
    '192.168.4.1',
    'http://192.168.4.1/ws',
    'ws://a/ws#fragment',
    'ws://user:pass@a/ws',
  ])
    assert.throws(() => validateEndpoint(url))
  assert.throws(() => validateEndpoint('ws://192.168.4.1/ws', 'https:'), /HTTPS/)
})
await test('el historial elimina datos anteriores a 120 segundos y tiene un límite de memoria', () => {
  const sample: Sample = { timestamp: 200_000, values: [1, 2, 3] }
  assert.deepEqual(
    appendSample(
      [
        { ...sample, timestamp: 1 },
        { ...sample, timestamp: 80_000 },
      ],
      sample,
    ).map(({ timestamp }) => timestamp),
    [80_000, 200_000],
  )
  assert.equal(
    appendSample(
      Array.from({ length: MAX_SAMPLES }, () => sample),
      sample,
    ).length,
    MAX_SAMPLES,
  )
})
await test('el enlace relativo usa el dominio y la seguridad de la página, también con ngrok', () => {
  assert.equal(
    validateEndpoint('/ws/monitor', 'https:', 'https://voltio.ngrok-free.dev'),
    'wss://voltio.ngrok-free.dev/ws/monitor',
  )
  assert.equal(
    validateEndpoint('/ws/monitor', 'http:', 'http://localhost:5173'),
    'ws://localhost:5173/ws/monitor',
  )
  assert.throws(() =>
    validateEndpoint('//other.example/ws', 'https:', 'https://voltio.ngrok-free.dev'),
  )
  assert.throws(() =>
    validateEndpoint('/ws/monitor#fragment', 'https:', 'https://voltio.ngrok-free.dev'),
  )
  assert.throws(() => validateEndpoint('/ws/monitor', 'https:'))
})
await test('CSV conserva fecha ISO, orden de canales y precisión numérica', () => {
  const csv = samplesToCsv([{ timestamp: 0, values: [-30, 12, 50] }])
  assert.equal(
    csv,
    '\uFEFFfecha_iso,temperature_c,voltage_v,current_a\r\n1970-01-01T00:00:00.000Z,-30.0000,12.0000,50.0000',
  )
  assert.equal(
    samplesToCsv([{ timestamp: 0, values: [-12.3456, 11.2345, 0.0001] }]),
    '\uFEFFfecha_iso,temperature_c,voltage_v,current_a\r\n1970-01-01T00:00:00.000Z,-12.3456,11.2345,0.0001',
  )
})
