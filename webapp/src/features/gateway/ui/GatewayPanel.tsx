import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { APP_PATHS } from '../../../shared/contracts/navigation'
import { UnsavedChangesGuard } from '../../../shared/guards/UnsavedChangesGuard'
import { integerPipe, jsonPipe } from '../../../shared/pipes'
import { Notice } from '../../../shared/ui/Notice'
import { EXAMPLE_MEASUREMENTS } from '../../../shared/contracts/measurements'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Panel } from '../../../shared/ui/Panel'
import { useGateway } from '../model/useGateway'
import { useTelemetryActions } from '../../telemetry/model/useTelemetry'
import { GATEWAY_MONITOR_PATH, gatewaySenderUrl } from '../../../shared/contracts/gateway'
import type { GatewayConfig } from '../../../shared/contracts/gateway'
import styles from './gateway.module.css'

export function GatewaySettings() {
  const { status, error, save } = useGateway()
  const actions = useTelemetryActions()
  const [edited, setDraft] = useState<GatewayConfig | null>(null)
  const draft = edited ?? status?.config ?? null
  const dirty = edited !== null && status !== null && (
    edited.senderPath !== status.config.senderPath ||
    edited.deviceId !== status.config.deviceId ||
    edited.publicOrigin !== status.config.publicOrigin ||
    edited.enabled !== status.config.enabled
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  function update(patch: Partial<GatewayConfig>) {
    if (draft) setDraft({ ...draft, ...patch })
    setMessage('')
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    setSaving(true)
    setFailed(false)
    try {
      await save(draft)
      setDraft(null)
      setMessage('Configuración guardada. Comparte la dirección de recepción actualizada.')
      const snapshot = actions.getSnapshot()
      if (snapshot.endpoint === GATEWAY_MONITOR_PATH && snapshot.connection.source === 'device')
        actions.connect()
    } catch (failure) {
      setFailed(true)
      setMessage(failure instanceof Error ? failure.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Panel className={styles.card}>
      <span className={styles.cardIcon}>
        <Icon name="wifi" size={28} />
      </span>
      <h2>Configura la recepción</h2>
      <p>
        El receptor se inicia con la aplicación. El ESP32 solo debe conectarse a la dirección
        compartida y enviar el JSON de temperatura, voltaje y corriente. Los ajustes se guardan aquí.
      </p>
      {error && <Notice alert>El receptor no responde. Conservamos tus cambios y volveremos a consultar automáticamente.</Notice>}
      {status?.configWarning && <Notice alert>{status.configWarning}</Notice>}
      {!draft ? (
        <p role="status">{error || 'Cargando configuración del receptor…'}</p>
      ) : (
        <form className={styles.form} onSubmit={(event) => { void submit(event) }}>
          <label htmlFor="gateway-device">
            Identificador del ESP32
            <input
              id="gateway-device"
              value={draft.deviceId}
              onChange={(event) => update({ deviceId: event.target.value })}
              maxLength={48}
              required
              autoCapitalize="off"
              spellCheck={false}
            />
            <small>Permite identificar al emisor que se conectará.</small>
          </label>
          <label htmlFor="gateway-path">
            Ruta de recepción
            <input
              id="gateway-path"
              value={draft.senderPath}
              onChange={(event) => update({ senderPath: event.target.value })}
              required
              autoCapitalize="off"
              spellCheck={false}
            />
            <small>Por ejemplo, /ws/esp32. Los cambios se aplican al servidor.</small>
          </label>
          <label htmlFor="gateway-origin">
            URL pública o dirección de la aplicación <span>{status?.environmentPublicOrigin ? '(desde .env)' : '(opcional)'}</span>
            <input
              id="gateway-origin"
              value={status?.environmentPublicOrigin || draft.publicOrigin}
              readOnly={!!status?.environmentPublicOrigin}
              onChange={(event) => update({ publicOrigin: event.target.value })}
              placeholder="https://tu-dominio.ngrok-free.dev"
              inputMode="url"
              autoCapitalize="off"
              spellCheck={false}
            />
            <small>
              {status?.environmentPublicOrigin
                ? 'Definida por NGROK_URL en webapp/.env. Actualiza ese archivo y reinicia la aplicación cuando cambie el dominio.'
                : 'Configura NGROK_URL en webapp/.env o deja este campo vacío para detectar el túnel de ngrok automáticamente.'}
            </small>
          </label>
          <label className={styles.checkbox} htmlFor="gateway-enabled">
            <input
              id="gateway-enabled"
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
            />
            <span>Aceptar conexiones del ESP32</span>
          </label>
          <Button type="submit" variant="primary" disabled={saving || (!dirty && !status?.configWarning)}>
            <Icon name="check" size={18} />
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </Button>
        </form>
      )}
      {message && (
        <p role={failed ? 'alert' : 'status'} className={failed ? styles.error : styles.success}>
          {message}
        </p>
      )}
      <UnsavedChangesGuard when={dirty} />
    </Panel>
  )
}

export function DeviceEndpoint() {
  const navigate = useNavigate()
  const { status, error } = useGateway()
  const actions = useTelemetryActions()
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)
  const url = status ? gatewaySenderUrl(status, window.location.origin) : ''
  const publicOrigin = status?.environmentPublicOrigin || status?.config.publicOrigin || status?.detectedPublicOrigin
  const parsedUrl = url ? new URL(url) : null
  const copied = copiedUrl === url
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
    <Panel className={styles.card}>
      <div className={styles.endpointHeading}>
        <span className={styles.eyebrow}>PARA COMPARTIR CON EL EMISOR</span>
        <span className={`${styles.presence} ${!error && status?.deviceConnected ? styles.connected : ''}`}>
          {error ? 'Reconectando receptor' : !status
            ? 'Consultando receptor'
            : !status.config.enabled
              ? 'Recepción pausada'
              : status.deviceConnected
                ? 'ESP32 conectado'
                : 'Esperando ESP32'}
        </span>
      </div>
      <h2>Dirección para el ESP32</h2>
      <p>
        Copia esta dirección y compártela con quien programará el ESP32 en Arduino IDE. Tras
        conectarse, puede enviar temperatura, voltaje y corriente directamente, sin comandos de suscripción.
      </p>
      {publicOrigin && <div className={styles.publicTunnel} role="status">
        <Icon name="check" size={20} />
        <div><strong>{status?.environmentPublicOrigin ? 'URL pública configurada · web y WebSocket en el mismo túnel' : status?.config.publicOrigin ? 'URL pública guardada · web y WebSocket en el mismo túnel' : 'Ngrok detectado · web y WebSocket en el mismo túnel'}</strong>
          <a href={`${publicOrigin}/connection`} target="_blank" rel="noreferrer" data-testid="public-webapp-url">{publicOrigin}<Icon name="arrow" size={16} /></a>
        </div>
      </div>}
      <label className={styles.endpointLabel} htmlFor="sender-url">
        WebSocket de envío
        <textarea
          id="sender-url"
          data-testid="sender-url"
          readOnly
          rows={3}
          value={url}
          placeholder={error || 'Preparando dirección…'}
        />
      </label>
      <div className={styles.actions}>
        <Button onClick={() => { void copy() }} disabled={!url}>
          <Icon name={copied ? 'check' : 'copy'} size={18} />
          {copied ? 'Dirección copiada' : 'Copiar dirección'}
        </Button>
        <Button
          variant="primary"
          disabled={!status}
          onClick={() => {
            actions.setEndpoint(GATEWAY_MONITOR_PATH)
            actions.connect()
            void navigate(APP_PATHS.monitor)
          }}
        >
          <Icon name="pulse" size={18} />
          Ver datos en el monitor
        </Button>
      </div>
      {parsedUrl && (
        <dl className={`${styles.stats} ${styles.addressParts}`}>
          <div>
            <dt>Servidor</dt>
            <dd>{parsedUrl.hostname}</dd>
          </div>
          <div>
            <dt>Puerto</dt>
            <dd>{parsedUrl.port || (parsedUrl.protocol === 'wss:' ? '443' : '80')}</dd>
          </div>
          <div>
            <dt>Ruta para el firmware</dt>
            <dd>
              {parsedUrl.pathname}
              {parsedUrl.search}
            </dd>
          </div>
        </dl>
      )}
      {copyError && (
        <p role="status">
          Selecciona la dirección y cópiala manualmente; el navegador no permite usar el
          portapapeles.
        </p>
      )}
      <div className={styles.payload}>
        <span>MENSAJE DE TEXTO JSON</span>
        <pre>
          <code>{jsonPipe(EXAMPLE_MEASUREMENTS, 0)}</code>
        </pre>
      </div>
      <dl className={styles.stats}>
        <div>
          <dt>Mensajes recibidos</dt>
          <dd data-testid="gateway-received">{integerPipe(status?.received ?? 0)}</dd>
        </div>
        <div>
          <dt>Mensajes descartados</dt>
          <dd>{integerPipe(status?.rejected ?? 0)}</dd>
        </div>
        <div>
          <dt>Monitores conectados</dt>
          <dd>{integerPipe(status?.monitorCount ?? 0)}</dd>
        </div>
      </dl>
      <p className={styles.help}>
        Ejecuta <code>ngrok http 5173</code> para compartir la web y el socket con un único dominio.
        La dirección WSS se genera a partir de NGROK_URL en webapp/.env o del túnel detectado.
      </p>
    </Panel>
  )
}
