import type { NumericInput } from './number.pipe.ts'

const clockOptions = { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' } as const
const clock = new Intl.DateTimeFormat('es', clockOptions)

export function durationPipe(milliseconds: NumericInput): string {
  const seconds = typeof milliseconds === 'number' && Number.isFinite(milliseconds)
    ? Math.max(0, Math.floor(milliseconds / 1_000))
    : 0
  return [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60]
    .map((part) => part.toString().padStart(2, '0'))
    .join(':')
}

export function timePipe(timestamp: NumericInput, timeZone?: string): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '—'
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return '—'
  const formatter = timeZone ? new Intl.DateTimeFormat('es', { ...clockOptions, timeZone }) : clock
  return formatter.format(date)
}
