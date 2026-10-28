import { useNow } from '../../../shared/hooks/useNow'
import { Link } from 'react-router'
import { APP_PATHS } from '../../../shared/contracts/navigation'
import { decimalPipe, durationPipe, integerPipe } from '../../../shared/pipes'
import { Icon } from '../../../shared/ui/Icon'
import { Panel, PanelHeader } from '../../../shared/ui/Panel'
import { useTelemetrySelector } from '../model/useTelemetry'
import styles from './telemetry.module.css'

export function SessionCard() {
  const metrics = useTelemetrySelector((state) => state.metrics)
  const startedAt = useTelemetrySelector((state) => state.connection.startedAt)
  const stoppedAt = useTelemetrySelector((state) => state.connection.stoppedAt)
  const source = useTelemetrySelector((state) => state.connection.source)
  const now = useNow()
  return (
    <Panel className={styles.sessionCard}>
      <PanelHeader
        title="Esta sesión"
        description="Los detalles de tu conexión."
        actions={<Icon name="layers" size={21} />}
      />
      <div className={styles.sessionDevice}>
        <span>
          <Icon name="chip" size={28} />
        </span>
        <div>
          <strong>
            {source === 'demo' ? 'ESP32 simulado' : 'ESP32'}
            <small>3 señales</small>
          </strong>
          <p>Temperatura · voltaje · corriente</p>
        </div>
      </div>
      <dl className={styles.sessionStats}>
        <div>
          <dt>
            <Icon name="wifi" size={18} />
            Frecuencia recibida
          </dt>
          <dd>
            {decimalPipe(metrics.rate, 1)}
            <small> Hz</small>
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="clock" size={18} />
            Tiempo de sesión
          </dt>
          <dd>{durationPipe(startedAt === null ? 0 : (stoppedAt ?? now) - startedAt)}</dd>
        </div>
        <div>
          <dt>
            <Icon name="layers" size={18} />
            Mensajes válidos
          </dt>
          <dd data-testid="valid-messages">{integerPipe(metrics.received)}</dd>
        </div>
        <div>
          <dt>
            <Icon name="info" size={18} />
            Descartados
          </dt>
          <dd data-testid="invalid-messages" className={metrics.invalid ? styles.invalidCount : ''}>
            {integerPipe(metrics.invalid)}
          </dd>
        </div>
      </dl>
      <div className={styles.sessionTip}>
        <Icon name="code" size={21} />
        <div>
          <strong>Simple por naturaleza.</strong>
          <p>Tu ESP32 envía JSON. Voltio se encarga del resto.</p>
          <Link to={APP_PATHS.protocol}>
            Ver protocolo
            <Icon name="arrow" size={16} />
          </Link>
        </div>
      </div>
    </Panel>
  )
}
