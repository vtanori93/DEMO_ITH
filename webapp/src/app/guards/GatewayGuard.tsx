import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useGateway } from '../../features/gateway/model/useGateway'
import { APP_PATHS } from '../../shared/contracts/navigation'
import { Panel } from '../../shared/ui/Panel'
import { RouteLoading } from '../routing/RouteLoading'
import styles from '../../shared/ui/ui.module.css'

export function GatewayGuard({ children }: { children: ReactNode }) {
  const { status, error } = useGateway()
  if (status) return children
  if (!error) return <RouteLoading />
  return (
    <Panel role="alert" style={{ padding: '1.5rem' }}>
      <h1>Receptor no disponible</h1>
      <p>No se puede abrir la configuración. La aplicación volverá a comprobar la conexión automáticamente.</p>
      <div className={styles.headingActions}>
        <Link to={APP_PATHS.monitor} className={`${styles.button} ${styles.primary}`}>Ir al monitor</Link>
        <Link to={APP_PATHS.protocol} className={`${styles.button} ${styles.quiet}`}>Ver protocolo</Link>
      </div>
    </Panel>
  )
}
