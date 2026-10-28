import { useTelemetrySelector } from '../model/useTelemetry'
import { statusLabels } from '../model/status-labels'
import styles from '../../../shared/ui/ui.module.css'

export function ConnectionStatusBadge() {
  const status = useTelemetrySelector((state) => state.connection.status)
  const stale = useTelemetrySelector((state) => state.connection.stale)
  const tone =
    stale || ['demo', 'connecting', 'reconnecting'].includes(status)
      ? 'warning'
      : status === 'connected'
        ? 'positive'
        : status === 'error'
          ? 'danger'
          : ''
  return (
    <span
      data-testid="connection-status"
      className={`${styles.badge} ${tone ? styles[tone] : ''}`}
      role="status"
    >
      {stale ? 'Sin datos recientes' : statusLabels[status]}
    </span>
  )
}
