import { RELIABILITY } from '../contracts/reliability.ts'

export async function fetchJson(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = RELIABILITY.requestTimeoutMs,
): Promise<{ response: Response; payload: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('El servidor tardó demasiado en responder.')), timeoutMs)
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal
  try {
    const response = await fetch(url, { ...options, signal })
    const payload: unknown = await response.json()
    return { response, payload }
  } finally {
    clearTimeout(timer)
  }
}
