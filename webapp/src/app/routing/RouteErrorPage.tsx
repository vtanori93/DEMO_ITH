import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'
import { APP_PATHS } from '../../shared/contracts/navigation'
import { Panel } from '../../shared/ui/Panel'
import { Button } from '../../shared/ui/Button'
import styles from '../../shared/ui/ui.module.css'

export function RouteErrorPage() {
  const error = useRouteError()
  useEffect(() => {
    document.title = 'No se pudo abrir la vista · Voltio'
    console.error('No se pudo mostrar la vista.', error)
  }, [error])
  return (
    <Panel role="alert" style={{ padding: '1.5rem' }}>
      <h1>No pudimos abrir esta vista</h1>
      <p>Se produjo un error al mostrar esta vista. Puedes volver al monitor o recargar la aplicación.</p>
      <div className={styles.headingActions}>
        <Button onClick={() => window.location.reload()} variant="primary">Volver a cargar</Button>
        <Link className={`${styles.button} ${styles.quiet}`} to={APP_PATHS.monitor}>Ir al monitor</Link>
      </div>
    </Panel>
  )
}
