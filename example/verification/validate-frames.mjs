import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { parseTelemetry } from '../../webapp/src/features/telemetry/domain/telemetry.ts'

const directory = new URL('./artifacts/', import.meta.url)
const results = []
for (const configuration of ['original', 'three-networks']) {
  const input = await readFile(new URL(`messages-${configuration}.jsonl`, directory), 'utf8')
  let accepted = 0
  for (const line of input.trim().split('\n')) {
    const values = JSON.parse(line)
    assert.deepEqual(parseTelemetry(line), [values.temperature, values.voltage, values.current])
    accepted++
  }
  results.push({ configuration, accepted, rejected: 0 })
}
await writeFile(new URL('receiver-contract-results.json', directory), `${JSON.stringify(results, null, 2)}\n`)
console.log(JSON.stringify({ validator: 'parseTelemetry real de Voltio', results }, null, 2))
