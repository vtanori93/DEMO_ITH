import { useContext } from 'react'
import { IndicatorContext } from './indicator-context'

export function useIndicators() {
  const context = useContext(IndicatorContext)
  if (!context) throw new Error('IndicatorProvider debe envolver el monitor.')
  return context
}
