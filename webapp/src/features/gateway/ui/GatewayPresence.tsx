import { useGateway } from '../model/useGateway'
import { useTelemetrySelector } from '../../telemetry/model/useTelemetry'
import { GATEWAY_MONITOR_PATH } from '../../../shared/contracts/gateway'
import { statusLabels } from '../../telemetry/model/status-labels'
import { Link } from 'react-router'
import { APP_PATHS } from '../../../shared/contracts/navigation'
import { Notice } from '../../../shared/ui/Notice'
import styles from './gateway.module.css'

export function GatewayPresence() {
  const { status, error } = useGateway()
  const endpoint = useTelemetrySelector((state) => state.endpoint)
  const source = useTelemetrySelector((state) => state.connection.source)
  if ((!status && !error) || source === 'demo' || endpoint !== GATEWAY_MONITOR_PATH) return null
  return (
    <>
    <div className={styles.monitorPresence}>
      <IconStatus connected={!error && !!status?.deviceConnected} />
      <span>
        {error ? 'Receptor sin respuesta. Reconectando automáticamente…' : !status?.config.enabled
          ? 'Receptor pausado'
          : status.deviceConnected
            ? `ESP32 conectado · ${status.config.deviceId}`
            : 'Esperando la conexión del ESP32'}
      </span>
      <Link to={APP_PATHS.connection}>Configurar recepción</Link>
    </div>
    {status?.configWarning && <Notice alert>{status.configWarning}</Notice>}
    </>
  )
}
function IconStatus({ connected }: { connected: boolean }) {
  return <span className={`${styles.dot} ${connected ? styles.connected : ''}`} />
}

export function DeviceStateLabel() {
  const { status, error } = useGateway()
  const source = useTelemetrySelector((state) => state.connection.source)
  const endpoint = useTelemetrySelector((state) => state.endpoint)
  const connection = useTelemetrySelector((state) => state.connection.status)
  if (source === 'demo') return <>Dispositivo simulado</>
  if (endpoint === GATEWAY_MONITOR_PATH)
    return (
      <>
        {error ? 'Reconectando receptor' : !status
          ? 'Consultando receptor'
          : !status.config.enabled
            ? 'Recepción pausada'
            : status.deviceConnected
              ? 'Conectado'
              : 'Esperando emisor'}
      </>
    )
  return <>{statusLabels[connection]}</>
}
