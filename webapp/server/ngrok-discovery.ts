import { isRecord } from '../src/shared/lib/guards.ts'
import { isPublicHttpsOrigin } from '../src/shared/contracts/gateway.ts'

export interface NgrokDiscoveryOptions {
  getPort: () => number | null
  agentOrigin?: string
  intervalMs?: number
  timeoutMs?: number
  staleAfterMs?: number
}

function matchesLocalPort(address: unknown, port: number): boolean {
  if (typeof address !== 'string' && typeof address !== 'number') return false
  const value = String(address)
  if (/^\d+$/.test(value)) return Number(value) === port
  try {
    const url = new URL(value.includes('://') ? value : `http://${value}`)
    return ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]', '0.0.0.0', '[::]'].includes(url.hostname) &&
      Number(url.port || (url.protocol === 'https:' ? 443 : 80)) === port
  } catch { return false }
}

/** Admite la API actual de endpoints y la representación anterior de túneles. */
export function parseNgrokOrigins(payload: unknown, port: number): string[] {
  if (!isRecord(payload)) return []
  const entries: unknown[] = Array.isArray(payload.endpoints) ? payload.endpoints
    : Array.isArray(payload.tunnels) ? payload.tunnels : []
  const origins = new Set<string>()
  for (const entry of entries) {
    if (!isRecord(entry)) continue
    const address = isRecord(entry.upstream) ? entry.upstream.url
      : isRecord(entry.config) ? entry.config.addr : null
    const origin = entry.url ?? entry.public_url
    if (matchesLocalPort(address, port) && isPublicHttpsOrigin(origin))
      origins.add(new URL(origin).origin)
  }
  return [...origins].sort()
}

export function createNgrokDiscovery(options: NgrokDiscoveryOptions) {
  const controller = new AbortController()
  const agent = options.agentOrigin ?? 'http://127.0.0.1:4040'
  let origins: string[] = []
  let lastSuccess = 0
  let pending: Promise<void> | null = null
  let closed = false
  async function probe() {
    const port = options.getPort()
    if (port === null || closed) return
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(options.timeoutMs ?? 800)])
      const request = (path: string) => fetch(`${agent}${path}`, {
        signal, redirect: 'error', cache: 'no-store', headers: { accept: 'application/json' },
      })
      let response = await request('/api/endpoints')
      if (response.status === 404) response = await request('/api/tunnels')
      if (!response.ok) throw new Error('El agente ngrok no está disponible.')
      const payload: unknown = await response.json()
      if (!closed && options.getPort() === port) {
        origins = parseNgrokOrigins(payload, port)
        lastSuccess = Date.now()
      }
    } catch { /* La recepción local continúa aunque ngrok no esté en ejecución. */ }
  }
  function refresh(): Promise<void> {
    if (closed) return Promise.resolve()
    if (!pending) pending = probe().finally(() => { pending = null })
    return pending
  }
  const timer = setInterval(() => { void refresh() }, options.intervalMs ?? 1000)
  timer.unref()
  void refresh()
  const getOrigins = () => Date.now() - lastSuccess <= (options.staleAfterMs ?? 5000) ? origins : []
  return {
    refresh,
    getOrigins,
    getOrigin: () => getOrigins()[0] ?? null,
    close: () => { closed = true; clearInterval(timer); controller.abort() },
  }
}
