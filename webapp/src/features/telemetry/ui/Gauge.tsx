import type { CSSProperties } from 'react'
import { CHANNELS, measurementRatio } from '../domain/telemetry'
import type { ChannelIndex } from '../domain/telemetry'
import { decimalPipe } from '../../../shared/pipes'
import { MEASUREMENT_UNIT_NAMES } from '../../../shared/contracts/measurements'
import { defaultIndicator, thresholdState } from '../../indicators/domain/indicator-settings'
import type { IndicatorSettings } from '../../indicators/domain/indicator-settings'
import { Icon } from '../../../shared/ui/Icon'
import { Button } from '../../../shared/ui/Button'
import styles from './Gauge.module.css'

interface GaugeProps {
  channel: ChannelIndex
  value: number | null
  minimum: number | null
  maximum: number | null
  fresh: boolean
  settings?: IndicatorSettings
  onCustomize?: (trigger: HTMLButtonElement) => void
  preview?: boolean
}
const ARC = 'M40 150 A105 105 0 1 1 240 150'

export function Gauge({ channel, value, minimum, maximum, fresh, settings, onCustomize, preview = false }: GaugeProps) {
  const info = CHANNELS[channel]
  const options = settings ?? defaultIndicator(info)
  const ratio = value === null ? 0 : Math.max(0, Math.min(1, measurementRatio(value, info)))
  const warning = thresholdState(value, options)
  const formatted = decimalPipe(value, options.decimals)
  const ring = options.style === 'ring'
  const circular = ring || options.style === 'arc'
  const valueScale = Math.min(options.valueSize === 'large' ? 1.18 : 1, circular ? 5.5 / Math.max(1, formatted.length) : 1.18)
  const lower = measurementRatio(options.thresholds.lower, info)
  const upper = measurementRatio(options.thresholds.upper, info)
  const meter = value === null ? {} : {
    'aria-valuemin': info.minimum, 'aria-valuemax': info.maximum, 'aria-valuenow': value,
    'aria-valuetext': `${formatted} ${MEASUREMENT_UNIT_NAMES[info.unit]}${fresh ? '' : ', última lectura'}${warning === 'normal' ? '' : warning === 'low' ? ', bajo el umbral' : ', sobre el umbral'}`,
  }
  const shape = ring
    ? { cx: 140, cy: 105, r: 86, transform: 'rotate(-90 140 105)' }
    : { d: ARC }
  const Shape = ring ? 'circle' : 'path'
  return (
    <article
      className={styles.card}
      data-testid={preview ? undefined : `indicator-${info.key}`}
      aria-label={`${preview ? 'Vista previa de' : 'Indicador de'} ${info.name}`}
      data-style={options.style}
      data-warning={warning !== 'normal' && fresh}
      data-animated={options.animated}
      style={{ '--channel-color': options.color, '--gauge-thickness': options.thickness, '--value-scale': valueScale } as CSSProperties}
    >
      <div className={styles.header}>
        <span className={styles.tag}><span />{info.short}</span>
        <div className={styles.actions}>
          <span className={styles.state} data-fresh={fresh}>
            {preview ? 'Vista previa' : fresh ? 'Recibiendo' : value === null ? 'Sin datos' : 'Última lectura'}
          </span>
          {onCustomize && <Button variant="icon" aria-label={`Personalizar ${info.name}`} title={`Personalizar ${info.name}`} onClick={(event) => onCustomize(event.currentTarget)}><Icon name="sliders" size={18} /></Button>}
        </div>
      </div>
      <h2>{options.name}</h2>
      <div className={styles.visual} role={value === null ? 'img' : 'meter'} aria-label={`${options.name}, ${value === null ? 'sin datos' : 'valor actual'}`} {...meter}>
        {circular && (
          <svg viewBox={ring ? '0 0 280 220' : '0 0 280 185'} className={styles.svg} aria-hidden="true">
            <Shape {...shape} className={styles.track} pathLength="100" />
            {options.thresholds.enabled && <>
              {lower > 0 && <Shape {...shape} className={styles.thresholdBand} pathLength="100" strokeDasharray={`${lower * 100} 100`} />}
              {upper < 1 && <Shape {...shape} className={styles.thresholdBand} pathLength="100" strokeDasharray={`${(1 - upper) * 100} 100`} strokeDashoffset={-upper * 100} />}
            </>}
            {value !== null && ratio > 0 && <Shape {...shape} className={styles.fill} pathLength="100" strokeDasharray={`${ratio * 100} 100`} />}
            {options.showTicks && Array.from({ length: ring ? 40 : 21 }, (_, index) => {
              const angle = ((ring ? -90 + index * 9 : 162 + index * 10.8) * Math.PI) / 180
              const radius = ring ? 72 : 88
              const inner = radius - (index % 4 === 0 ? 8 : 4)
              const centerY = ring ? 105 : 117.9
              return <line key={index} x1={140 + radius * Math.cos(angle)} y1={centerY + radius * Math.sin(angle)} x2={140 + inner * Math.cos(angle)} y2={centerY + inner * Math.sin(angle)} stroke="#c1cdbf" strokeWidth="1.2" />
            })}
          </svg>
        )}
        <div className={styles.number} data-empty={value === null}>
          <div className={styles.valueLine}>
            <span data-testid={preview ? undefined : `value-${info.key}`}>{formatted}</span>
            <span className={styles.unit}>{info.unit}</span>
          </div>
          <small>{preview ? 'Valor de ejemplo' : `${info.name} actual`}</small>
        </div>
        {options.style === 'bar' && <div className={styles.bar} aria-hidden="true">
          {options.showTicks && <div className={styles.barTicks} />}
          <div className={styles.barFill} style={{ width: `${ratio * 100}%` }} />
          {options.thresholds.enabled && <>
            <span className={styles.barThreshold} style={{ left: `${lower * 100}%` }} />
            <span className={styles.barThreshold} style={{ left: `${upper * 100}%` }} />
          </>}
        </div>}
        {options.showScale && <div className={styles.scale} aria-hidden="true"><span>{info.minimum} {info.unit}</span><span>{info.maximum} {info.unit}</span></div>}
      </div>
      {options.thresholds.enabled && <p className={styles.thresholdLabel} data-alert={fresh && warning !== 'normal'}>
        <Icon name={warning !== 'normal' && fresh ? 'info' : 'check'} size={15} />
        {!fresh || value === null ? 'Umbrales' : warning === 'low' ? 'Bajo el umbral' : warning === 'high' ? 'Sobre el umbral' : 'Dentro de umbrales'}
        <span>{options.thresholds.lower}–{options.thresholds.upper} {info.unit}</span>
      </p>}
      {options.showExtrema && <dl className={styles.stats}>
        <div><dt>Mínimo</dt><dd>{decimalPipe(minimum, options.decimals)} <small>{info.unit}</small></dd></div>
        <div className={styles.range}><dt>Rango</dt><dd>{info.minimum}–{info.maximum} {info.unit}</dd></div>
        <div><dt>Máximo</dt><dd>{decimalPipe(maximum, options.decimals)} <small>{info.unit}</small></dd></div>
      </dl>}
    </article>
  )
}
