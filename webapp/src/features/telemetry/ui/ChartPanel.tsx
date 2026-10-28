import { useState } from 'react'
import { useNow } from '../../../shared/hooks/useNow'
import { downloadText } from '../../../shared/lib/download'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Panel, PanelHeader } from '../../../shared/ui/Panel'
import { CHANNELS, samplesToCsv } from '../domain/telemetry'
import type { Sample } from '../domain/telemetry'
import { useTelemetryActions, useTelemetrySelector } from '../model/useTelemetry'
import { SignalChart } from './SignalChart'
import { useIndicators } from '../../indicators/model/useIndicators'
import styles from './telemetry.module.css'

export function ChartPanel() {
  const { settings } = useIndicators()
  const samples = useTelemetrySelector((state) => state.samples)
  const source = useTelemetrySelector((state) => state.connection.source)
  const startedAt = useTelemetrySelector((state) => state.connection.startedAt)
  const lastReceivedAt = useTelemetrySelector((state) => state.connection.lastReceivedAt)
  const status = useTelemetrySelector((state) => state.connection.status)
  const stale = useTelemetrySelector((state) => state.connection.stale)
  const actions = useTelemetryActions()
  const now = useNow()
  const [seconds, setSeconds] = useState(30)
  const [visible, setVisible] = useState([true, true, true])
  const [paused, setFrozen] = useState<{
    samples: Sample[]
    timestamp: number
    source: typeof source
    startedAt: number | null
  } | null>(null)
  const frozen = paused?.source === source && paused.startedAt === startedAt ? paused : null
  const chartNow = frozen?.timestamp ?? Math.max(now, lastReceivedAt ?? now)
  const fresh = ['connected', 'demo'].includes(status) && !stale && lastReceivedAt !== null
  function exportCsv() {
    const snapshot = actions.getSnapshot()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadText(
      samplesToCsv(snapshot.samples),
      `voltio-${snapshot.connection.source === 'demo' ? 'simulacion-' : ''}${timestamp}.csv`,
    )
  }
  return (
    <Panel className={styles.chartCard}>
      <PanelHeader
        title="Historial de señales"
        description="Cada variable con su unidad y escala, segundo a segundo."
        actions={
          <div className={styles.periodControl} aria-label="Ventana del historial">
            {[30, 60, 120].map((period) => (
              <button
                key={period}
                aria-pressed={seconds === period}
                onClick={() => setSeconds(period)}
              >
                {period} s
              </button>
            ))}
          </div>
        }
      />
      <div className={styles.chartToolbar}>
        <div className={styles.chartLegend} aria-label="Canales visibles">
          {CHANNELS.map(({ key }, index) => (
            <button
              key={key}
              aria-pressed={visible[index]}
              onClick={() =>
                setVisible((current) =>
                  current.map((value, position) => (position === index ? !value : value)),
                )
              }
            >
              <span style={{ background: settings[key].color }} />
              {settings[key].name}
            </button>
          ))}
        </div>
        <div className={styles.chartTools}>
          <span>°C · V · A</span>
          <Button
            variant="icon"
            aria-label={frozen ? 'Reanudar gráfica' : 'Pausar gráfica'}
            title="Pausar la gráfica no detiene la recepción"
            disabled={!samples.length}
            onClick={() =>
              setFrozen(frozen ? null : { samples, timestamp: chartNow, source, startedAt })
            }
          >
            <Icon name={frozen ? 'play' : 'pause'} size={18} />
          </Button>
          <Button
            variant="icon"
            aria-label="Limpiar historial"
            disabled={!samples.length}
            onClick={() => {
              setFrozen(null)
              actions.resetHistory()
            }}
          >
            <Icon name="reset" size={18} />
          </Button>
        </div>
      </div>
      <div className={styles.chartInset}>
        <SignalChart
          samples={frozen?.samples ?? samples}
          seconds={seconds}
          now={chartNow}
          visible={visible}
          onDemo={actions.startDemo}
        />
      </div>
      <div className={styles.chartFooter}>
        <span>
          <i className={fresh && !frozen ? styles.liveDot : styles.idleDot} />
          {frozen ? 'Gráfica pausada' : fresh ? 'Actualización en tiempo real' : 'Esperando datos'}
        </span>
        <Button variant="quiet" disabled={!samples.length} onClick={exportCsv}>
          <Icon name="download" size={18} />
          Exportar CSV
        </Button>
      </div>
    </Panel>
  )
}
