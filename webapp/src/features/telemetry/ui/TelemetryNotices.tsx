import { Notice } from '../../../shared/ui/Notice'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { useTelemetryActions, useTelemetrySelector } from '../model/useTelemetry'

export function TelemetryNotices() {
  const source = useTelemetrySelector((state) => state.connection.source)
  const status = useTelemetrySelector((state) => state.connection.status)
  const stale = useTelemetrySelector((state) => state.connection.stale)
  const error = useTelemetrySelector((state) => state.connection.error)
  const warning = useTelemetrySelector((state) => state.connection.warning)
  const { disconnect } = useTelemetryActions()
  return (
    <>
      {source === 'demo' && (
        <Notice
          action={
            status === 'demo' && (
              <Button variant="quiet" aria-label="Detener simulación" onClick={disconnect}>
                <Icon name="close" size={18} />
              </Button>
            )
          }
        >
          <strong>{status === 'demo' ? 'Modo de simulación.' : 'Simulación detenida.'}</strong>{' '}
          Estás visualizando señales generadas, sin conexión a un ESP32.
        </Notice>
      )}
      {error && (
        <Notice tone="danger" alert>
          {error}
        </Notice>
      )}
      {warning && (
        <Notice alert>
          <strong>Mensaje descartado.</strong> {warning} La última lectura válida se conserva.
        </Notice>
      )}
      {stale && (
        <Notice>
          El socket está abierto, pero no se reciben lecturas válidas desde hace más de 3 segundos.
        </Notice>
      )}
    </>
  )
}
