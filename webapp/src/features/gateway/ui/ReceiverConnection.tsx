import { useId, useState } from 'react'
import { Link } from 'react-router'
import { APP_PATHS } from '../../../shared/contracts/navigation'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Panel } from '../../../shared/ui/Panel'
import { gatewaySenderUrl } from '../../../shared/contracts/gateway'
import { useGateway } from '../model/useGateway'
import styles from './gateway.module.css'
import ui from '../../../shared/ui/ui.module.css'

export function ReceiverConnection() {
  const { status, error } = useGateway()
  const id = useId()
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)
  const url = status ? gatewaySenderUrl(status, window.location.origin) : ''
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }
  return (
    <Panel className={styles.receiverBar} aria-label="Recepción de datos del ESP32">
      <div className={styles.receiverCaption}>
        <span className={styles.cardIcon}><Icon name="wifi" size={23} /></span>
        <div>
          <strong>Conecta y envía tus señales.</strong>
          <p>{error ? 'Receptor sin respuesta. Reintentando automáticamente…' : 'Recepción continua · una actualización por segundo.'}</p>
        </div>
      </div>
      <div className={styles.receiverActions}>
        <label className={styles.receiverUrl} htmlFor={id}>
          Dirección de recepción para el ESP32
          <input
            id={id}
            value={url}
            readOnly
            placeholder={error || 'Preparando dirección…'}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <Button onClick={() => { void copy() }} disabled={!url}>
          <Icon name={copiedUrl === url ? 'check' : 'copy'} size={18} />
          {copiedUrl === url ? 'Copiada' : 'Copiar dirección'}
        </Button>
        <Link to={APP_PATHS.connection} className={`${ui.button} ${ui.quiet}`}>Configurar</Link>
      </div>
      {copyError && <p role="status">Selecciona la dirección y cópiala manualmente.</p>}
    </Panel>
  )
}
