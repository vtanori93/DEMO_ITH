import { useId } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { useTelemetryActions, useTelemetrySelector } from '../model/useTelemetry'
import styles from './telemetry.module.css'

export function ConnectionForm() {
  const id = useId()
  const endpoint = useTelemetrySelector((state) => state.endpoint)
  const status = useTelemetrySelector((state) => state.connection.status)
  const { setEndpoint, connect, disconnect } = useTelemetryActions()
  const socketActive = ['connecting', 'connected', 'reconnecting'].includes(status)
  const running = socketActive || status === 'demo'
  function submit(event: FormEvent) {
    event.preventDefault()
    connect()
  }
  return (
    <form className={styles.connectionForm} onSubmit={submit}>
      <label className={styles.endpointField} htmlFor={id}>
        <Icon name="plug" size={20} />
        <span>
          Dirección WebSocket
          <input
            id={id}
            name="endpoint"
            type="text"
            inputMode="url"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            value={endpoint}
            disabled={socketActive}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder="/ws/monitor"
            required
          />
        </span>
      </label>
      {running ? (
        <Button
          key="disconnect"
          type="button"
          onClick={(event) => {
            event.preventDefault()
            disconnect()
          }}
        >
          <Icon name="plug" size={18} />
          {status === 'demo' ? 'Detener demo' : 'Desconectar'}
        </Button>
      ) : (
        <Button key="connect" type="submit" variant="primary">
          <Icon name="plug" size={18} />
          Conectar monitor
        </Button>
      )}
    </form>
  )
}
