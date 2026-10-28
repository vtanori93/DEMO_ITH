import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { GATEWAY_MONITOR_PATH } from '../src/shared/contracts/gateway.ts'
import type { GatewayConfig } from '../src/shared/contracts/gateway.ts'
import { isRecord } from '../src/shared/lib/guards.ts'

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  senderPath: '/ws/esp32',
  deviceId: 'esp32-01',
  publicOrigin: '',
  enabled: true,
}

export function validateGatewayConfig(value: unknown): GatewayConfig {
  if (!isRecord(value))
    throw new Error('La configuración debe ser un objeto.')
  const config = value
  if (
    typeof config.senderPath !== 'string' ||
    !/^\/ws\/[a-zA-Z0-9/_-]{1,80}$/.test(config.senderPath) ||
    config.senderPath === GATEWAY_MONITOR_PATH
  )
    throw new Error('Usa una ruta como /ws/esp32. La ruta /ws/monitor está reservada.')
  if (typeof config.deviceId !== 'string' || !/^[a-zA-Z0-9_-]{1,48}$/.test(config.deviceId))
    throw new Error('El identificador admite de 1 a 48 letras, números, guiones y guiones bajos.')
  if (typeof config.enabled !== 'boolean' || typeof config.publicOrigin !== 'string')
    throw new Error('El estado y la URL pública no son válidos.')
  let publicOrigin = ''
  if (config.publicOrigin.trim()) {
    let url: URL
    try {
      url = new URL(config.publicOrigin.trim())
    } catch {
      throw new Error('Introduce una URL pública http:// o https:// válida.')
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error(
        'La URL pública debe contener solo protocolo y dominio, sin ruta ni credenciales.',
      )
    publicOrigin = url.origin
  }
  return {
    senderPath: config.senderPath,
    deviceId: config.deviceId,
    enabled: config.enabled,
    publicOrigin,
  }
}

export async function loadGatewayConfig(
  file: string | null,
  onRecovery: (message: string) => void = console.warn,
): Promise<GatewayConfig> {
  if (!file) return { ...DEFAULT_GATEWAY_CONFIG }
  let missing = false
  try {
    return validateGatewayConfig(JSON.parse(await readFile(file, { encoding: 'utf8', signal: AbortSignal.timeout(3_000) })))
  } catch (error) {
    missing = isRecord(error) && error.code === 'ENOENT'
  }
  try {
    const backup = validateGatewayConfig(JSON.parse(await readFile(`${file}.bak`, { encoding: 'utf8', signal: AbortSignal.timeout(3_000) })))
    onRecovery('La configuración principal no estaba disponible. Se recuperó la última copia válida.')
    return backup
  } catch {
    if (!missing) onRecovery('No se pudo recuperar la configuración guardada. El receptor utiliza los ajustes iniciales; revísalos en Conexión.')
    return { ...DEFAULT_GATEWAY_CONFIG }
  }
}
async function atomicWrite(file: string, config: GatewayConfig) {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(config, null, 2), { mode: 0o600, signal: AbortSignal.timeout(3_000) })
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}
export async function saveGatewayConfig(file: string | null, config: GatewayConfig) {
  if (!file) return
  await atomicWrite(file, config)
  try { await atomicWrite(`${file}.bak`, config) }
  catch { console.warn('La configuración se guardó, pero no se pudo actualizar su copia de recuperación.') }
}
