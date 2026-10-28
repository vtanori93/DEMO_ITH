import { lazy } from 'react'
import { useLocation } from 'react-router'
import { APP_PATHS } from '../shared/contracts/navigation'
export type { RouteId } from '../shared/contracts/navigation'

export const routes = {
  monitor: {
    path: APP_PATHS.monitor,
    guard: 'public',
    label: 'Monitor',
    description: 'Temperatura, voltaje y corriente',
    icon: 'grid',
    component: lazy(() => import('../pages/MonitorPage')),
  },
  connection: {
    path: APP_PATHS.connection,
    guard: 'gateway',
    label: 'Conexión',
    description: 'Tu enlace con el ESP32',
    icon: 'plug',
    component: lazy(() => import('../pages/ConnectionPage')),
  },
  protocol: {
    path: APP_PATHS.protocol,
    guard: 'public',
    label: 'Protocolo de datos',
    description: 'El formato de tus mensajes',
    icon: 'code',
    component: lazy(() => import('../pages/ProtocolPage')),
  },
} as const
export function useRoute() {
  const { pathname } = useLocation()
  return Object.values(routes).find((route) => route.path === pathname.replace(/\/$/, '')) ?? null
}
