import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createTelemetryStore } from '../../features/telemetry/model/telemetry-store'
import { TelemetryContext } from '../../features/telemetry/model/telemetry-context'
import { createWebSocketTransport } from '../../features/telemetry/services/websocket-transport'
import { createDemoTransport } from '../../features/telemetry/services/demo-transport'
import { readSavedEndpoint, saveEndpoint } from '../../features/telemetry/services/endpoint-storage'
import { GATEWAY_MONITOR_PATH } from '../../shared/contracts/gateway'

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createTelemetryStore({
      endpoint: readSavedEndpoint(),
      createSocket: createWebSocketTransport,
      createDemo: createDemoTransport,
      saveEndpoint,
      pageProtocol: window.location.protocol,
      pageOrigin: window.location.origin,
    }),
  )
  useEffect(() => {
    const stop = store.start()
    let active = true
    queueMicrotask(() => {
      const snapshot = store.getSnapshot()
      if (active && snapshot.endpoint === GATEWAY_MONITOR_PATH && snapshot.connection.source === null)
        store.connect()
    })
    return () => {
      active = false
      stop()
    }
  }, [store])
  return <TelemetryContext value={store}>{children}</TelemetryContext>
}
