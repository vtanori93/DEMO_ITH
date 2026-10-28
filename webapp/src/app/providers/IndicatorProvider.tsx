import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { IndicatorContext } from '../../features/indicators/model/indicator-context'
import { INDICATOR_STORAGE_KEY, defaultIndicators, parseIndicatorSettings, serializeIndicatorSettings } from '../../features/indicators/domain/indicator-settings'
import type { IndicatorSettingsMap } from '../../features/indicators/domain/indicator-settings'

export function IndicatorProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() => {
    try { return parseIndicatorSettings(localStorage.getItem(INDICATOR_STORAGE_KEY)) }
    catch { return defaultIndicators() }
  })
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const save = useCallback((next: IndicatorSettingsMap) => {
    const validated = parseIndicatorSettings(serializeIndicatorSettings(next))
    setSettings(validated)
    try {
      localStorage.setItem(INDICATOR_STORAGE_KEY, serializeIndicatorSettings(validated))
      setStorageWarning(null)
    } catch {
      setStorageWarning('Los indicadores se han aplicado durante esta sesión. El navegador no permitió guardar la personalización para la próxima visita.')
    }
  }, [])
  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      try {
        if (event.storageArea === localStorage && (event.key === INDICATOR_STORAGE_KEY || event.key === null))
          setSettings(parseIndicatorSettings(event.newValue))
      } catch { /* El navegador puede revocar el acceso al almacenamiento durante la sesión. */ }
    }
    window.addEventListener('storage', synchronize)
    return () => window.removeEventListener('storage', synchronize)
  }, [])
  const value = useMemo(() => ({ settings, save, storageWarning }), [settings, save, storageWarning])
  return <IndicatorContext value={value}>{children}</IndicatorContext>
}
