import { useState } from 'react'
import { Button } from '../shared/ui/Button'
import { Icon } from '../shared/ui/Icon'
import { Panel } from '../shared/ui/Panel'
import { CHANNELS } from '../features/telemetry/domain/telemetry'
import { PageHeading } from '../features/telemetry/ui/PageHeading'
import { TelemetryNotices } from '../features/telemetry/ui/TelemetryNotices'
import styles from '../features/telemetry/ui/telemetry.module.css'
import ui from '../shared/ui/ui.module.css'
import { jsonPipe } from '../shared/pipes'
import { EXAMPLE_MEASUREMENTS } from '../shared/contracts/measurements'

const JSON_EXAMPLE = jsonPipe(EXAMPLE_MEASUREMENTS)
export default function ProtocolPage() {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  async function copyProtocol() {
    try {
      await navigator.clipboard.writeText(JSON_EXAMPLE)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }
  return (
    <>
      <PageHeading
        title="Un lenguaje en común"
        description="Temperatura, voltaje y corriente. Un mensaje JSON con las tres mediciones."
      />
      <TelemetryNotices />
      <div className={styles.informationGrid}>
        <Panel className={styles.infoCard}>
          <span className={styles.infoIcon}>
            <Icon name="code" size={28} />
          </span>
          <h2>Un mensaje, tres canales</h2>
          <p>
            El ESP32 actúa como cliente WebSocket y se conecta a la dirección que configuras en esta
            aplicación. Envía estas tres propiedades en cada actualización.
          </p>
          <div className={styles.codePanel}>
            <div>
              <span>MENSAJE DEL ESP32</span>
              <Button onClick={() => { void copyProtocol() }}>
                <Icon name={copied ? 'check' : 'copy'} size={17} />
                {copied ? 'Copiado' : 'Copiar JSON'}
              </Button>
            </div>
            <pre tabIndex={0} aria-label="Ejemplo JSON">
              <code>{JSON_EXAMPLE}</code>
            </pre>
          </div>
          {copyError && (
            <p role="status">
              Selecciona y copia el JSON manualmente; el navegador no permite acceder al
              portapapeles.
            </p>
          )}
          <div className={styles.protocolTags}>
            <span>JSON de texto</span>
            <span>°C · V · A</span>
            <span>3 valores por mensaje</span>
          </div>
        </Panel>
        <Panel className={styles.infoCard}>
          <span className={ui.eyebrow}>CONTRATO DE DATOS</span>
          <h2>Preparado para tu firmware en C</h2>
          <div className={styles.tableWrapper}>
            <table className={styles.protocolTable}>
              <caption>Variables, unidades y rangos admitidos</caption>
              <thead>
                <tr>
                  <th scope="col">Propiedad</th>
                  <th scope="col">Variable</th>
                  <th scope="col">Rango</th>
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map(({ key, name, color, minimum, maximum, unit }) => (
                  <tr key={key}>
                    <th scope="row">
                      <code>{key}</code>
                    </th>
                    <td>
                      <span style={{ color }}>●</span> {name}
                    </td>
                    <td>{minimum}–{maximum} {unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={styles.protocolRules}>
            <li>Envía las tres mediciones como números de punto flotante: temperatura en °C, voltaje en V y corriente en A. Usa punto decimal, sin unidades ni comillas dentro del JSON.</li>
            <li>Los decimales del indicador solo cambian su presentación. Las lecturas y el historial conservan el valor recibido; el CSV exporta cuatro decimales.</li>
            <li>Incluye los tres canales en cada mensaje. Se admiten campos adicionales.</li>
            <li>Los mensajes incompletos o fuera de rango se descartan y contabilizan.</li>
            <li>
              El mínimo y el máximo incluyen todos los mensajes válidos desde la última limpieza.
            </li>
          </ul>
          <a
            className={styles.documentationLink}
            href="https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/protocols/esp_http_server.html#websocket-server"
            target="_blank"
            rel="noreferrer"
          >
            Documentación WebSocket de ESP-IDF
            <Icon name="arrow" size={18} />
          </a>
        </Panel>
      </div>
    </>
  )
}
