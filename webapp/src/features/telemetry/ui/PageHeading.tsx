import { useEffect } from 'react'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { useTelemetryActions, useTelemetrySelector } from '../model/useTelemetry'
import { ConnectionStatusBadge } from './ConnectionStatus'
import styles from '../../../shared/ui/ui.module.css'

export function PageHeading({ title, description }: { title: string; description: string }) {
  const status = useTelemetrySelector((state) => state.connection.status)
  const { startDemo } = useTelemetryActions()
  useEffect(() => {
    document.title = `${title} · Voltio`
  }, [title])
  return (
    <div className={styles.heading}>
      <div className={styles.headingText}>
        <span className={styles.eyebrow}>TELEMETRÍA EN TIEMPO REAL</span>
        <h1 id="page-title">{title}</h1>
        <p>{description}</p>
      </div>
      <div className={styles.headingActions}>
        {status !== 'demo' && (
          <Button onClick={startDemo}>
            <Icon name="play" size={17} />
            Probar demo
          </Button>
        )}
        <ConnectionStatusBadge />
      </div>
    </div>
  )
}
