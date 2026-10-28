import { createContext } from 'react'
import type { GatewayConfig, GatewayStatus } from '../../../shared/contracts/gateway'

export interface GatewayContextValue {
  status: GatewayStatus | null
  error: string | null
  save: (config: GatewayConfig) => Promise<GatewayStatus>
}
export const GatewayContext = createContext<GatewayContextValue | null>(null)
