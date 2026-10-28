import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CHANNELS, EXAMPLE_READINGS } from '../../../shared/contracts/measurements'
import type { ChannelIndex } from '../../../shared/contracts/measurements'
import type { MeasurementChannel } from '../../../shared/contracts/measurements'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { trapDialogFocus } from '../../../shared/lib/dialog-focus'
import { Gauge } from '../../telemetry/ui/Gauge'
import { useIndicators } from '../model/useIndicators'
import { defaultIndicator, defaultIndicators, validateIndicator } from '../domain/indicator-settings'
import type { IndicatorSettings } from '../domain/indicator-settings'
import { IndicatorControls } from './IndicatorControls'
import styles from './customizer.module.css'

function Preview({ channel, settings }: { channel: MeasurementChannel; settings: IndicatorSettings }) {
  const [value, setValue] = useState<number>(EXAMPLE_READINGS[channel.index])
  const valid = validateIndicator(settings, channel)
  const options = {
    ...settings, name: settings.name.trim() || channel.name,
    color: /^#[a-f\d]{6}$/i.test(settings.color) ? settings.color : channel.color,
    thresholds: valid ? settings.thresholds : defaultIndicator(channel).thresholds,
  }
  return <>
    <Gauge channel={channel.index} settings={options} value={value} minimum={value} maximum={value} fresh preview />
    <label className={styles.previewSlider}>Probar un valor <strong>{value} {channel.unit}</strong><input type="range" min={channel.minimum} max={channel.maximum} step="0.1" value={value} onChange={(event) => setValue(event.target.valueAsNumber)} /></label>
    <p className={styles.hint}>La vista previa utiliza un valor de ejemplo. La recepción de datos continúa.</p>
  </>
}

export default function IndicatorCustomizer({ initialChannel, onDismiss }: { initialChannel: ChannelIndex; onDismiss: () => void }) {
  const { settings, save } = useIndicators()
  const [draft, setDraft] = useState(() => settings)
  const [selected, setSelected] = useState(initialChannel)
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const pointerOutside = useRef(false)
  const id = useId()
  const channel = CHANNELS[selected]
  const options = draft[channel.key]
  const valid = CHANNELS.every((item) => validateIndicator(draft[item.key], item))
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    closeButton.current?.focus({ preventScroll: true })
    return () => element?.close()
  }, [])
  function outside(x: number, y: number) {
    const bounds = dialog.current?.getBoundingClientRect()
    return !!bounds && (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom)
  }
  return createPortal(
    <dialog
      ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onClose={(event) => { if (!event.currentTarget.open) onDismiss() }}
      onKeyDown={trapDialogFocus}
      onPointerDown={(event) => { pointerOutside.current = outside(event.clientX, event.clientY) }}
      onClick={(event) => { if (pointerOutside.current && outside(event.clientX, event.clientY)) dialog.current?.close() }}
    >
      <div className={styles.header}>
        <div><span className={styles.eyebrow}>A TU MEDIDA</span><h2 id={`${id}-title`}>Personalizar indicadores</h2><p id={`${id}-description`}>Diseña cada señal. Los cambios se aplican al guardar en este navegador.</p></div>
        <Button ref={closeButton} variant="icon" aria-label="Cerrar personalización" onClick={() => dialog.current?.close()}><Icon name="close" size={21} /></Button>
      </div>
      <div className={styles.selector} role="group" aria-label="Variable a personalizar">
        {CHANNELS.map((item) => <button type="button" key={item.key} aria-label={`${item.name} ${item.unit}`} aria-pressed={selected === item.index} onClick={() => setSelected(item.index)}><span style={{ background: draft[item.key].color }} /><strong>{item.name}</strong><small>{item.unit}</small>{!validateIndicator(draft[item.key], item) && <Icon name="info" size={16} />}</button>)}
      </div>
      <div className={styles.body}>
        <section className={styles.preview} aria-label="Vista previa del indicador"><span className={styles.eyebrow}>VISTA PREVIA</span><Preview key={selected} channel={channel} settings={options} /></section>
        <IndicatorControls channel={channel} settings={options} onChange={(patch) => setDraft((current) => ({ ...current, [channel.key]: { ...current[channel.key], ...patch } }))} />
      </div>
      <div className={styles.resetActions}>
        <Button variant="quiet" onClick={() => setDraft((current) => ({ ...current, [channel.key]: defaultIndicator(channel) }))}><Icon name="reset" size={16} />Restaurar {channel.name}</Button>
        <Button variant="quiet" onClick={() => setDraft(defaultIndicators())}>Restaurar los tres</Button>
      </div>
      <div className={styles.footer}>
        <span role="status">{valid ? 'Tu configuración se conserva entre visitas.' : 'Revisa los campos marcados antes de guardar.'}</span>
        <div><Button onClick={() => dialog.current?.close()}>Cancelar</Button><Button variant="primary" aria-label="Guardar personalización" disabled={!valid} onClick={() => { save(draft); dialog.current?.close() }}><Icon name="check" size={18} />Guardar cambios</Button></div>
      </div>
    </dialog>, document.body,
  )
}
