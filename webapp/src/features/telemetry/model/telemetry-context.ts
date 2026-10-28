import { createContext } from 'react'
import type { TelemetryStore } from './telemetry-store'

export const TelemetryContext = createContext<TelemetryStore | null>(null)
