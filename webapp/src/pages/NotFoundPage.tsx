import { Link } from 'react-router'
import { APP_PATHS } from '../shared/contracts/navigation'
import { PageHeading } from '../features/telemetry/ui/PageHeading'
import { Panel } from '../shared/ui/Panel'
import styles from '../shared/ui/ui.module.css'

export default function NotFoundPage() {
  return (
    <>
      <PageHeading title="Página no encontrada" description="La dirección que has abierto no corresponde a ninguna vista." />
      <Panel style={{ padding: '1.5rem' }}>
        <p>Puedes volver al monitor para continuar con tus señales.</p>
        <Link to={APP_PATHS.monitor} className={`${styles.button} ${styles.primary}`}>Volver al monitor</Link>
      </Panel>
    </>
  )
}
