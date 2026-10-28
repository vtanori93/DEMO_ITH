import { useLocation } from 'react-router'
import MonitorPage from '../pages/MonitorPage'
import ConnectionPage from '../pages/ConnectionPage'
import ProtocolPage from '../pages/ProtocolPage'
import { APP_PATHS } from '../shared/contracts/navigation'
export type { RouteId } from '../shared/contracts/navigation'

// Las vistas forman parte de la carga inicial. Navegar no debe depender de
// otra descarga que pueda fallar al perder cobertura o reanudar una pestaña.
export const routes = {
  monitor: {
    path: APP_PATHS.monitor,
    guard: 'public',
    label: 'Monitor',
    description: 'Temperatura, voltaje y corriente',
    icon: 'grid',
    component: MonitorPage,
  },
  connection: {
    path: APP_PATHS.connection,
    guard: 'gateway',
    label: 'Conexión',
    description: 'Tu enlace con el ESP32',
    icon: 'plug',
    component: ConnectionPage,
  },
  protocol: {
    path: APP_PATHS.protocol,
    guard: 'public',
    label: 'Protocolo de datos',
    description: 'El formato de tus mensajes',
    icon: 'code',
    component: ProtocolPage,
  },
} as const
export function useRoute() {
  const { pathname } = useLocation()
  return Object.values(routes).find((route) => route.path === pathname.replace(/\/$/, '')) ?? null
}
