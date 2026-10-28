import { Fragment, memo, useId, useMemo } from 'react'
import { useElementWidth } from '../../../shared/hooks/useElementWidth'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { CHANNELS, measurementRatio } from '../domain/telemetry'
import type { Sample } from '../domain/telemetry'
import { measurementPipe, timePipe } from '../../../shared/pipes'
import { RELIABILITY } from '../../../shared/contracts/reliability'
import { useIndicators } from '../../indicators/model/useIndicators'
import styles from './telemetry.module.css'

interface ChartProps {
  samples: Sample[]
  seconds: number
  now: number
  visible: boolean[]
  onDemo: () => void
}

export const SignalChart = memo(function SignalChart({ samples, seconds, now, visible, onDemo }: ChartProps) {
  const { settings } = useIndicators()
  const { ref, width, fontSize } = useElementWidth()
  const id = useId().replaceAll(':', '')
  const scale = fontSize / 18
  const left = 44 * scale
  const right = Math.max(200, width) - 14 * scale
  const channels = CHANNELS.filter((channel) => visible[channel.index]).map((channel) => ({
    ...channel, name: settings[channel.key].name, color: settings[channel.key].color,
  }))
  const rowHeight = 128 * scale
  const height = Math.max(1, channels.length) * rowHeight + 32 * scale
  const rowTop = (index: number) => index * rowHeight + 28 * scale
  const start = now - seconds * 1_000
  const windowSamples = useMemo(
    () => samples.filter((sample) => sample.timestamp >= start && sample.timestamp <= now),
    [samples, start, now],
  )
  const segments = useMemo(() => {
    const groups: Sample[][] = []
    for (const sample of windowSamples) {
      const segment = groups.at(-1)
      const previous = segment?.at(-1)
      if (!segment || !previous || sample.timestamp - previous.timestamp > RELIABILITY.staleAfterMs)
        groups.push([sample])
      else segment.push(sample)
    }
    return groups
  }, [windowSamples])
  const lastSample = windowSamples.at(-1)
  const x = (timestamp: number) => left + ((timestamp - start) / (seconds * 1_000)) * (right - left)
  const ticks = Math.max(1, Math.min(width < 480 ? 3 : 5, Math.floor((right - left) / (fontSize * 4)) + 1))
  const tickFraction = (index: number) => ticks === 1 ? 1 : index / (ticks - 1)
  return (
    <div ref={ref} className={styles.chartWrapper} style={{ height }}>
      <svg
        className={styles.signalChart}
        style={{ height }}
        viewBox={`0 0 ${Math.max(200, width)} ${height}`}
        role="img"
        aria-label={`Historial de los últimos ${seconds} segundos. ${channels.map((channel) => `${channel.name}: ${channel.minimum} a ${channel.maximum} ${channel.unit}`).join('. ')}.`}
      >
        <defs>
          {channels.map((channel, index) => (
            <Fragment key={channel.key}>
              <clipPath id={`${id}-${channel.key}-clip`}>
                <rect x={left} y={rowTop(index) - 4 * scale} width={right - left + 4} height={88 * scale} />
              </clipPath>
              <linearGradient id={`${id}-${channel.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={channel.color} stopOpacity=".15" />
                <stop offset="100%" stopColor={channel.color} stopOpacity="0" />
              </linearGradient>
            </Fragment>
          ))}
        </defs>
        {channels.map((channel, row) => {
          const top = rowTop(row)
          const bottom = top + 80 * scale
          const y = (value: number) => bottom - measurementRatio(value, CHANNELS[channel.index]) * (bottom - top)
          return (
            <g key={channel.key} data-testid={`chart-${channel.key}`}>
              <text x={left} y={top - 12 * scale} className={styles.chartSeriesLabel} fill={channel.color}>
                {channel.name} · {channel.unit}
              </text>
              {channel.ticks.map((value) => (
                <g key={value}>
                  <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#e4ebe3" strokeDasharray="4 5" />
                  <text x={left - 9 * scale} y={y(value) + 4 * scale} textAnchor="end" className={styles.chartLabel}>{value}</text>
                </g>
              ))}
              {Array.from({ length: ticks }, (_, index) => (
                <line key={index} x1={left + tickFraction(index) * (right - left)} x2={left + tickFraction(index) * (right - left)}
                  y1={top} y2={bottom} stroke="#edf1eb" />
              ))}
              <g clipPath={`url(#${id}-${channel.key}-clip)`}>
                {segments.map((segment, index) => {
                  const first = segment[0]
                  const last = segment.at(-1)
                  if (!first || !last) return null
                  const points = segment.map((sample) =>
                    `${x(sample.timestamp).toFixed(1)},${y(sample.values[channel.index]).toFixed(1)}`,
                  ).join(' ')
                  return (
                    <g key={index}>
                      <polygon points={`${x(first.timestamp)},${bottom} ${points} ${x(last.timestamp)},${bottom}`} fill={`url(#${id}-${channel.key})`} />
                      <polyline points={points} fill="none" stroke={channel.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
                    </g>
                  )
                })}
                {lastSample && (
                  <circle cx={x(lastSample.timestamp)} cy={y(lastSample.values[channel.index])} r="3.5" fill={channel.color} stroke="white" strokeWidth="1.5">
                    <title>{channel.name}: {measurementPipe(lastSample.values[channel.index], channel.unit)}</title>
                  </circle>
                )}
              </g>
            </g>
          )
        })}
        {Array.from({ length: ticks }, (_, index) => (
          <text key={index} x={left + tickFraction(index) * (right - left)} y={height - 8 * scale}
            textAnchor={ticks === 1 || index === ticks - 1 ? 'end' : index === 0 ? 'start' : 'middle'} className={styles.chartLabel}>
            {timePipe(start + seconds * 1_000 * tickFraction(index))}
          </text>
        ))}
      </svg>
      {windowSamples.length === 0 && (
        <div className={styles.chartEmpty}>
          <span className={styles.emptyIcon}><Icon name="pulse" size={27} /></span>
          <strong>Esperando la primera señal</strong>
          <span>Conecta tu ESP32 para ver las tres variables en tiempo real.</span>
          <Button variant="quiet" onClick={onDemo}>Probar datos simulados<Icon name="arrow" size={16} /></Button>
        </div>
      )}
      {windowSamples.length > 0 && channels.length === 0 && (
        <div className={styles.chartEmpty}>
          <strong>Selecciona una variable</strong>
          <span>Activa una señal en la leyenda para mostrarla.</span>
        </div>
      )}
    </div>
  )
})
