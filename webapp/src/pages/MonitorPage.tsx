import { lazy, Suspense, useRef, useState } from 'react'
import { Icon } from '../shared/ui/Icon'
import { Button } from '../shared/ui/Button'
import { Notice } from '../shared/ui/Notice'
import { useIndicators } from '../features/indicators/model/useIndicators'
import type { ChannelIndex } from '../shared/contracts/measurements'
import { CHANNELS } from '../features/telemetry/domain/telemetry'
import { useTelemetrySelector } from '../features/telemetry/model/useTelemetry'
import { PageHeading } from '../features/telemetry/ui/PageHeading'
import { TelemetryNotices } from '../features/telemetry/ui/TelemetryNotices'
import { Gauge } from '../features/telemetry/ui/Gauge'
import { ChartPanel } from '../features/telemetry/ui/ChartPanel'
import { SessionCard } from '../features/telemetry/ui/SessionCard'
import { GatewayPresence } from '../features/gateway/ui/GatewayPresence'
import { ReceiverConnection } from '../features/gateway/ui/ReceiverConnection'
import styles from '../features/telemetry/ui/telemetry.module.css'

const IndicatorCustomizer = lazy(() => import('../features/indicators/ui/IndicatorCustomizer'))

function Measurements({ onCustomize }: { onCustomize: (channel: ChannelIndex, trigger: HTMLButtonElement) => void }) {
  const { settings } = useIndicators()
  const readings = useTelemetrySelector((state) => state.readings)
  const status = useTelemetrySelector((state) => state.connection.status)
  const stale = useTelemetrySelector((state) => state.connection.stale)
  const fresh = ['connected', 'demo'].includes(status) && !stale && readings.values !== null
  return (
    <section className={styles.gaugeGrid} aria-label="Temperatura, voltaje y corriente">
      {CHANNELS.map(({ key, index }) => (
        <Gauge
          key={key}
          channel={index}
          value={readings.values?.[index] ?? null}
          minimum={readings.minimum?.[index] ?? null}
          maximum={readings.maximum?.[index] ?? null}
          fresh={fresh}
          settings={settings[key]}
          onCustomize={(trigger) => onCustomize(index, trigger)}
        />
      ))}
    </section>
  )
}

export default function MonitorPage() {
  const [customizing, setCustomizing] = useState<ChannelIndex | null>(null)
  const customizationTrigger = useRef<HTMLButtonElement>(null)
  const { storageWarning } = useIndicators()
  function customize(channel: ChannelIndex, trigger: HTMLButtonElement) {
    customizationTrigger.current = trigger
    setCustomizing(channel)
  }
  return (
    <>
      <PageHeading
        title="Monitor de variables"
        description="Temperatura, voltaje y corriente. Tus señales, en tiempo real."
      />
      <TelemetryNotices />
      <GatewayPresence />
      <ReceiverConnection />
      {storageWarning && <Notice tone="warning">{storageWarning}</Notice>}
      <div className={styles.sectionHeading}>
        <h2>
          Variables monitoreadas<span>03</span>
        </h2>
        <Button variant="secondary" onClick={(event) => customize(0, event.currentTarget)}><Icon name="sliders" size={18} />Personalizar indicadores</Button>
      </div>
      <Measurements onCustomize={customize} />
      {customizing !== null && <Suspense fallback={<p role="status">Abriendo personalización…</p>}>
        <IndicatorCustomizer initialChannel={customizing} onDismiss={() => {
          setCustomizing(null)
          customizationTrigger.current?.focus({ preventScroll: true })
        }} />
      </Suspense>}
      <div className={styles.lowerGrid}>
        <ChartPanel />
        <SessionCard />
      </div>
      <p className={styles.bottomNote}>
        <Icon name="info" size={16} />
        Temperatura: −30–100 °C · Voltaje: 0–12 V · Corriente: 0–50 A.
        El historial conserva hasta 120 segundos de mediciones.
      </p>
    </>
  )
}
