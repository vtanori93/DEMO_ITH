import { isPublicHttpsOrigin } from '../src/shared/contracts/gateway.ts'

/** URL pública compartida por HTTP y WebSocket; nunca acepta rutas ni credenciales. */
export function getPublicOrigin(value = ''): string | null {
  const origin = value.trim()
  if (!origin) return null
  if (!isPublicHttpsOrigin(origin))
    throw new Error('NGROK_URL debe ser una URL https:// con dominio, sin ruta, parámetros ni credenciales.')
  return new URL(origin).origin
}

/** Solo se permite el host concreto indicado por el propietario del túnel. */
export function getAllowedHosts(host = ''): string[] {
  const hostname = host.trim().toLowerCase()
  if (!hostname) return []
  if (
    !/^(?=.{1,253}$)(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(hostname)
  )
    throw new Error(
      'NGROK_HOST debe ser un dominio concreto, sin protocolo, puerto, ruta ni comodines.',
    )
  return [hostname]
}
