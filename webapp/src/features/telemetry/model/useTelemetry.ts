import { useContext, useSyncExternalStore } from 'react'
import { TelemetryContext } from './telemetry-context'
import type { TelemetrySnapshot } from './types'

export function useTelemetryActions() {
  const store = useContext(TelemetryContext)
  if (!store) throw new Error('TelemetryProvider debe envolver las vistas de telemetría.')
  return store
}

/** Los selectores devuelven valores primitivos o referencias existentes del snapshot. */
export function useTelemetrySelector<T>(selector: (snapshot: TelemetrySnapshot) => T): T {
  const store = useTelemetryActions()
  return useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()))
}
