import { useEffect } from 'react'
import { Link } from 'react-router'
import { APP_PATHS } from '../../shared/contracts/navigation'
import { Panel } from '../../shared/ui/Panel'
import { Button } from '../../shared/ui/Button'
import styles from '../../shared/ui/ui.module.css'

export function RouteErrorPage() {
  useEffect(() => { document.title = 'No se pudo abrir la vista · Voltio' }, [])
  return (
    <Panel role="alert" style={{ padding: '1.5rem' }}>
      <h1>No pudimos abrir esta vista</h1>
      <p>Comprueba tu conexión y vuelve a intentarlo.</p>
      <div className={styles.headingActions}>
        <Button onClick={() => window.location.reload()} variant="primary">Volver a cargar</Button>
        <Link className={`${styles.button} ${styles.quiet}`} to={APP_PATHS.monitor}>Ir al monitor</Link>
      </div>
    </Panel>
  )
}
