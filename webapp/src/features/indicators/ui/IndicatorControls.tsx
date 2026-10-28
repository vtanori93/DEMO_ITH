import { useId } from 'react'
import { ACCENT_COLORS, INDICATOR_STYLES } from '../domain/indicator-settings'
import type { IndicatorSettings } from '../domain/indicator-settings'
import type { MeasurementChannel } from '../../../shared/contracts/measurements'
import { Icon } from '../../../shared/ui/Icon'
import styles from './customizer.module.css'

interface ControlsProps {
  settings: IndicatorSettings
  channel: MeasurementChannel
  onChange: (patch: Partial<IndicatorSettings>) => void
}
export function IndicatorControls({ settings, channel, onChange }: ControlsProps) {
  const id = useId()
  const validColor = /^#[a-f\d]{6}$/i.test(settings.color)
  const limits = settings.thresholds
  const validLimits = Number.isFinite(limits.lower) && Number.isFinite(limits.upper)
    && limits.lower >= channel.minimum && limits.upper <= channel.maximum && limits.lower < limits.upper
  return (
    <div className={styles.controls}>
      <fieldset>
        <legend>Identidad y color</legend>
        <label className={styles.field}>Nombre del indicador
          <input value={settings.name} maxLength={40} required aria-invalid={!settings.name.trim()} onChange={(event) => onChange({ name: event.target.value })} />
        </label>
        {!settings.name.trim() && <p className={styles.error} role="alert">Escribe un nombre para el indicador.</p>}
        <div className={styles.palette} role="group" aria-label="Colores sugeridos">
          {ACCENT_COLORS.map((color) => <button key={color} type="button" aria-label={`Usar color ${color}`} aria-pressed={settings.color.toLowerCase() === color} style={{ background: color }} onClick={() => onChange({ color })}><Icon name="check" size={18} /></button>)}
        </div>
        <div className={styles.colorRow}>
          <label className={styles.colorPicker}>Color personalizado<input type="color" value={validColor ? settings.color : channel.color} onChange={(event) => onChange({ color: event.target.value })} /></label>
          <label className={styles.field}>Código HEX<input value={settings.color} maxLength={7} spellCheck={false} aria-invalid={!validColor} aria-describedby={!validColor ? `${id}-color-error` : undefined} onChange={(event) => onChange({ color: event.target.value })} /></label>
        </div>
        {!validColor && <p className={styles.error} id={`${id}-color-error`} role="alert">Introduce un color como #4981d9.</p>}
      </fieldset>
      <fieldset>
        <legend>Estilo de visualización</legend>
        <div className={styles.styleOptions} role="group" aria-label="Estilo del indicador">
          {INDICATOR_STYLES.map(({ value, label, icon }) => <button key={value} type="button" aria-pressed={settings.style === value} onClick={() => onChange({ style: value })}><Icon name={icon} size={25} /><span>{label}</span></button>)}
        </div>
        <div className={styles.twoColumns}>
          <label className={styles.field}>Decimales
            <select aria-label="Decimales" value={settings.decimals} onChange={(event) => {
              const value = Number(event.target.value)
              if (value === 0 || value === 1 || value === 2 || value === 3 || value === 4) onChange({ decimals: value })
            }}>{[0, 1, 2, 3, 4].map((value) => <option value={value} key={value}>{value} {value === 1 ? 'decimal' : 'decimales'}</option>)}</select>
          </label>
          <label className={styles.field}>Tamaño del valor
            <select aria-label="Tamaño del valor" value={settings.valueSize} onChange={(event) => { if (event.target.value === 'normal' || event.target.value === 'large') onChange({ valueSize: event.target.value }) }}><option value="normal">Estándar</option><option value="large">Grande</option></select>
          </label>
        </div>
        <label className={styles.field}>Grosor del trazo <span>{settings.thickness} px</span>
          <input type="range" min="6" max="20" step="1" value={settings.thickness} disabled={settings.style === 'digital'} onChange={(event) => onChange({ thickness: event.target.valueAsNumber })} />
        </label>
        <div className={styles.switches}>
          {([
            ['showScale', 'Mostrar límites de escala'], ['showTicks', 'Mostrar divisiones'],
            ['showExtrema', 'Mostrar mínimos y máximos'], ['animated', 'Animar las actualizaciones'],
          ] as const).map(([key, label]) => <label key={key} className={styles.switch}><input type="checkbox" role="switch" checked={settings[key]} onChange={(event) => onChange({ [key]: event.target.checked })} /><span>{label}</span></label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend>Umbrales de aviso</legend>
        <label className={styles.switch}><input type="checkbox" role="switch" checked={limits.enabled} onChange={(event) => onChange({ thresholds: { enabled: event.target.checked, lower: validLimits ? limits.lower : channel.minimum, upper: validLimits ? limits.upper : channel.maximum } })} /><span>Activar avisos visuales</span></label>
        <p>La tarjeta avisa cuando una lectura reciente queda fuera del intervalo.</p>
        <div className={styles.twoColumns}>
          <label className={styles.field}>Umbral inferior ({channel.unit})<input type="number" step="any" min={channel.minimum} max={channel.maximum} disabled={!limits.enabled} value={Number.isFinite(limits.lower) ? limits.lower : ''} aria-invalid={limits.enabled && !validLimits} aria-describedby={limits.enabled && !validLimits ? `${id}-threshold-error` : undefined} onChange={(event) => onChange({ thresholds: { ...limits, lower: event.target.valueAsNumber } })} /></label>
          <label className={styles.field}>Umbral superior ({channel.unit})<input type="number" step="any" min={channel.minimum} max={channel.maximum} disabled={!limits.enabled} value={Number.isFinite(limits.upper) ? limits.upper : ''} aria-invalid={limits.enabled && !validLimits} aria-describedby={limits.enabled && !validLimits ? `${id}-threshold-error` : undefined} onChange={(event) => onChange({ thresholds: { ...limits, upper: event.target.valueAsNumber } })} /></label>
        </div>
        {limits.enabled && !validLimits && <p id={`${id}-threshold-error`} className={styles.error} role="alert">El límite inferior debe ser menor que el superior, dentro de {channel.minimum} a {channel.maximum} {channel.unit}.</p>}
        <p className={styles.hint}>Rango de medición: {channel.minimum} a {channel.maximum} {channel.unit}. Los avisos no modifican las lecturas ni el historial.</p>
      </fieldset>
    </div>
  )
}
