import { fork } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { isRecord } from '../src/shared/lib/guards.ts'
import { fetchJson } from '../src/shared/lib/fetch-json.ts'
import { GATEWAY_HEALTH_PATH } from '../src/shared/contracts/reliability.ts'

interface SupervisorOptions {
  env?: NodeJS.ProcessEnv
  quiet?: boolean
  restartDelayMs?: number
  healthIntervalMs?: number
  healthTimeoutMs?: number
  maxHealthFailures?: number
  startupTimeoutMs?: number
  shutdownTimeoutMs?: number
}

export function startSupervisor(options: SupervisorOptions = {}) {
  let child: ChildProcess | null = null
  let stopping = false
  let restarting = false
  let restarts = 0
  let failures = 0
  let attempts = 0
  let startedAt = 0
  let healthUrl: string | null = null
  let checking: AbortController | null = null
  let stopPromise: Promise<void> | null = null
  let restartTimer: ReturnType<typeof setTimeout> | undefined
  let startupTimer: ReturnType<typeof setTimeout> | undefined
  let killTimer: ReturnType<typeof setTimeout> | undefined
  const log = (message: string) => { if (!options.quiet) console.warn(`[Voltio] ${message}`) }

  function clearAttempt() {
    clearTimeout(startupTimer)
    clearTimeout(killTimer)
    checking?.abort()
    checking = null
    healthUrl = null
  }
  function restart(reason: string) {
    if (stopping || restarting || !child) return
    restarting = true
    log(`${reason} Reiniciando el receptor.`)
    const current = child
    clearAttempt()
    current.kill('SIGTERM')
    killTimer = setTimeout(() => current.kill('SIGKILL'), options.shutdownTimeoutMs ?? 2_000)
  }
  function launch() {
    if (stopping) return
    restarting = false
    failures = 0
    startedAt = Date.now()
    const current = fork(new URL('./index.ts', import.meta.url), [], {
      env: { ...process.env, ...options.env },
      stdio: options.quiet ? ['ignore', 'ignore', 'ignore', 'ipc'] : ['inherit', 'inherit', 'inherit', 'ipc'],
    })
    child = current
    startupTimer = setTimeout(() => restart('El servidor no terminó de iniciar.'), options.startupTimeoutMs ?? 10_000)
    current.on('message', (message: unknown) => {
      if (stopping || restarting || child !== current || !isRecord(message) ||
          message.type !== 'ready' || typeof message.port !== 'number' ||
          !Number.isInteger(message.port) || message.port < 1 || message.port > 65535 ||
          typeof message.host !== 'string') return
      clearTimeout(startupTimer)
      const host = message.host === '0.0.0.0' ? '127.0.0.1' : message.host === '::' ? '[::1]' : message.host
      const url = new URL(`http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${message.port}`)
      url.pathname = GATEWAY_HEALTH_PATH
      healthUrl = url.href
    })
    current.on('error', (error) => { log(`No se pudo ejecutar el servidor: ${error.message}`) })
    current.once('close', () => {
      if (child !== current) return
      child = null
      clearAttempt()
      if (stopping) return
      restarts++
      const delay = Math.min(5_000, (options.restartDelayMs ?? 1_000) * 2 ** Math.min(attempts++, 3))
      log(`El servidor se detuvo. Nuevo intento en ${delay} ms.`)
      restartTimer = setTimeout(launch, delay)
    })
  }
  async function check() {
    if (stopping || restarting || checking || !child || !healthUrl) return
    const current = child
    const controller = new AbortController()
    checking = controller
    try {
      const { response, payload } = await fetchJson(healthUrl, { signal: controller.signal }, options.healthTimeoutMs ?? 2_000)
      if (!response.ok || !isRecord(payload) || payload.status !== 'ready') throw new Error('Receptor sin respuesta')
      if (child !== current || stopping || restarting) return
      failures = 0
      if (Date.now() - startedAt >= 15_000) attempts = 0
    } catch {
      if (child === current && !controller.signal.aborted && ++failures >= (options.maxHealthFailures ?? 3))
        restart('El servidor dejó de responder.')
    } finally {
      if (checking === controller) checking = null
    }
  }
  const healthTimer = setInterval(() => { void check() }, options.healthIntervalMs ?? 1_000)
  launch()
  return {
    getSnapshot: () => ({ pid: child?.pid ?? null, ready: healthUrl !== null && !restarting, restarts, healthUrl }),
    stop: (): Promise<void> => {
      if (stopPromise) return stopPromise
      stopping = true
      clearInterval(healthTimer)
      clearTimeout(restartTimer)
      clearAttempt()
      const current = child
      stopPromise = !current ? Promise.resolve() : new Promise<void>((resolve) => {
        current.once('close', () => { clearTimeout(killTimer); resolve() })
        current.kill('SIGTERM')
        killTimer = setTimeout(() => current.kill('SIGKILL'), options.shutdownTimeoutMs ?? 2_000)
      })
      return stopPromise
    },
  }
}

if (import.meta.main) {
  const supervisor = startSupervisor()
  const stop = () => { void supervisor.stop().catch((error: unknown) => { console.error(error); process.exitCode = 1 }) }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}
