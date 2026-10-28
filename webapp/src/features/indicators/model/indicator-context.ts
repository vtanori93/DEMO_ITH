import { createContext } from 'react'
import type { IndicatorSettingsMap } from '../domain/indicator-settings'

export interface IndicatorContextValue {
  settings: IndicatorSettingsMap
  storageWarning: string | null
  save: (settings: IndicatorSettingsMap) => void
}
export const IndicatorContext = createContext<IndicatorContextValue | null>(null)
