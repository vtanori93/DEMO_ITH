export const APP_PATHS = {
  monitor: '/monitor',
  connection: '/connection',
  protocol: '/protocol',
} as const

export type RouteId = keyof typeof APP_PATHS
