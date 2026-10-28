import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { GatewayContext } from '../../features/gateway/model/gateway-context'
import { GATEWAY_API_PATH, parseGatewayStatus } from '../../shared/contracts/gateway'
import { isRecord } from '../../shared/lib/guards'
import { fetchJson } from '../../shared/lib/fetch-json'
import { RELIABILITY } from '../../shared/contracts/reliability'
import type { GatewayConfig, GatewayStatus } from '../../shared/contracts/gateway'

export function GatewayProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GatewayStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mutation = useRef(false)
  const revision = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    let busy = false
    async function refresh() {
      if (busy || mutation.current) return
      busy = true
      const currentRevision = revision.current
      try {
        const { response, payload } = await fetchJson(`${GATEWAY_API_PATH}/status`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('El servidor receptor no está disponible.')
        const next = parseGatewayStatus(payload)
        if (!controller.signal.aborted && currentRevision === revision.current) {
          setStatus(next)
          setError(null)
        }
      } catch {
        if (!controller.signal.aborted)
          setError('No se pudo consultar el receptor de la aplicación.')
      } finally {
        busy = false
      }
    }
    void refresh()
    const timer = setInterval(() => {
      void refresh()
    }, RELIABILITY.sampleIntervalMs)
    const resume = () => { void refresh() }
    window.addEventListener('online', resume)
    window.addEventListener('focus', resume)
    return () => {
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('online', resume)
      window.removeEventListener('focus', resume)
    }
  }, [])
  const save = useCallback(async (config: GatewayConfig) => {
    mutation.current = true
    revision.current++
    try {
      const { response, payload } = await fetchJson(`${GATEWAY_API_PATH}/config`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!response.ok)
        throw new Error(
          isRecord(payload) && typeof payload.error === 'string'
            ? payload.error
            : 'No se pudo guardar la configuración.',
        )
      const data = parseGatewayStatus(payload)
      setStatus(data)
      setError(null)
      return data
    } finally {
      mutation.current = false
    }
  }, [])
  return <GatewayContext value={{ status, error, save }}>{children}</GatewayContext>
}
