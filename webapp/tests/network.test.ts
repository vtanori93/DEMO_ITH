import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getAllowedHosts, getPublicOrigin } from '../config/network.ts'

await test('NGROK_URL normaliza el origen HTTPS y rechaza URLs que no pueden compartir web y socket', () => {
  assert.equal(getPublicOrigin(), null)
  assert.equal(getPublicOrigin('  '), null)
  assert.equal(getPublicOrigin(' HTTPS://Voltio-Test.ngrok-free.dev:443/ '), 'https://voltio-test.ngrok-free.dev')
  assert.equal(getPublicOrigin('https://proxy.example:8443'), 'https://proxy.example:8443')
  for (const value of [
    'voltio.ngrok-free.dev', 'http://voltio.ngrok-free.dev', 'wss://voltio.ngrok-free.dev',
    'https://voltio.ngrok-free.dev/connection', 'https://voltio.ngrok-free.dev/ws/esp32',
    'https://user:password@voltio.ngrok-free.dev', 'https://voltio.ngrok-free.dev?device=esp32',
    'https://voltio.ngrok-free.dev#monitor',
  ]) assert.throws(() => getPublicOrigin(value), /NGROK_URL/)
})

await test('ngrok admite solo el dominio concreto configurado', () => {
  assert.deepEqual(getAllowedHosts(), [])
  assert.deepEqual(getAllowedHosts(' Voltio-Test.ngrok-free.dev '), ['voltio-test.ngrok-free.dev'])
  for (const host of [
    '*',
    '.ngrok-free.dev',
    'https://app.ngrok.dev',
    'app.ngrok.dev/path',
    'app.ngrok.dev:443',
    'app.ngrok.dev,evil.example',
  ])
    assert.throws(() => getAllowedHosts(host))
})
