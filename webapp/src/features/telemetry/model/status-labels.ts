import type { ConnectionStatus } from './types'

export const statusLabels: Record<ConnectionStatus, string> = {
  disconnected: 'Sin conexión',
  connecting: 'Conectando',
  connected: 'Conectado',
  reconnecting: 'Reconectando',
  demo: 'Simulación',
  error: 'Error de conexión',
}
