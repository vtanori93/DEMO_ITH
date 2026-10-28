import { PageHeading } from '../features/telemetry/ui/PageHeading'
import { TelemetryNotices } from '../features/telemetry/ui/TelemetryNotices'
import { ConnectionForm } from '../features/telemetry/ui/ConnectionForm'
import { DeviceEndpoint, GatewaySettings } from '../features/gateway/ui/GatewayPanel'
import styles from '../features/telemetry/ui/telemetry.module.css'

export default function ConnectionPage() {
  return (
    <>
      <PageHeading
        title="Conecta tu dispositivo"
        description="Configura aquí la recepción y comparte la dirección con quien enviará los datos."
      />
      <TelemetryNotices />
      <div className={styles.informationGrid}>
        <GatewaySettings />
        <DeviceEndpoint />
      </div>
      <details className={styles.advancedConnection}>
        <summary>Conexión del monitor · opciones avanzadas</summary>
        <p>
          El monitor se conecta automáticamente al receptor de esta aplicación. La dirección
          para el ESP32 se muestra arriba. Estas opciones permiten pausar la visualización o
          conectar el monitor a otro servidor WebSocket.
        </p>
        <ConnectionForm />
      </details>
    </>
  )
}
