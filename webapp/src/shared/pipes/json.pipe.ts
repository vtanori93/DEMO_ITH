export function jsonPipe(value: unknown, indentation: 0 | 2 = 2): string {
  try {
    return JSON.stringify(value, null, indentation) ?? '—'
  } catch {
    return '—'
  }
}
