import { Navigate, useLocation } from 'react-router'
import { APP_PATHS } from '../../shared/contracts/navigation'

export function IndexRedirect() {
  const { hash, search } = useLocation()
  const legacy = Object.entries(APP_PATHS).find(([id]) => hash === `#${id}`)
  return <Navigate to={`${legacy?.[1] ?? APP_PATHS.monitor}${search}`} replace />
}
