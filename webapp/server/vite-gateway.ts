import { resolve } from 'node:path'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import type { IncomingMessage } from 'node:http'
import { isIP } from 'node:net'
import { createGateway } from './gateway.ts'
import { createNgrokDiscovery } from './ngrok-discovery.ts'
import type { NgrokDiscoveryOptions } from './ngrok-discovery.ts'

export function gatewayPlugin(
  ngrokOptions: Omit<NgrokDiscoveryOptions, 'getPort'> = {},
  environmentPublicOrigin: string | null = null,
): Plugin {
  const closers = new Set<() => Promise<void>>()
  async function configure(server: ViteDevServer | PreviewServer) {
    if (!server.httpServer) return
    const httpServer = server.httpServer
    const getPort = () => {
      const address = httpServer.address()
      return address && typeof address !== 'string' ? address.port : null
    }
    const discovery = createNgrokDiscovery({ ...ngrokOptions, getPort })
    const file = process.env.VOLTIO_GATEWAY_CONFIG || resolve('.voltio/gateway.json')
    const gateway = await createGateway({
      configFile: file === ':memory:' ? null : file, getDetectedPublicOrigin: discovery.getOrigin,
      environmentPublicOrigin,
    })
    // Vite fija sus hosts al arrancar. Adaptamos los orígenes de confianza del
    // entorno, del panel o del agente local, tanto en HTTP como en el upgrade de HMR.
    function normalizeHost(request: IncomingMessage): boolean {
      if (!request.headers.host) return false
      try {
        const host = new URL(`http://${request.headers.host}`)
        if (host.pathname !== '/' || host.username || host.password || host.search || host.hash) return false
        const status = gateway.getStatus()
        const configured = status.environmentPublicOrigin || status.config.publicOrigin
        const origins = [...discovery.getOrigins(), ...(configured ? [configured] : [])]
        if (!origins.some((origin) => new URL(origin).hostname === host.hostname)) return false
        request.headers.host = `localhost:${getPort() ?? 5173}`
        return true
      } catch { return false }
    }
    httpServer.prependListener('upgrade', normalizeHost)
    const tunnelMiddleware: Connect.NextHandleFunction = (request, _response, next) => {
      void (async () => {
        const hostname = request.headers.host?.toLowerCase().replace(/:\d+$/, '') ?? ''
        const local = hostname === 'localhost' || hostname.endsWith('.localhost') ||
          isIP(hostname.replace(/^\[|\]$/g, '')) !== 0
        if (!normalizeHost(request) && request.headers.host && !local) {
          await discovery.refresh()
          normalizeHost(request)
        }
        next()
      })().catch((error: unknown) => next(error))
    }
    // Vite 8 registra la comprobación de hosts antes de configureServer.
    // Connect expone su pila tipada para insertar esta adaptación antes de ella.
    const tunnelLayer: Connect.ServerStackItem = { route: '', handle: tunnelMiddleware }
    server.middlewares.stack.unshift(tunnelLayer)
    const detach = gateway.attach(server.httpServer)
    const close = async () => {
      discovery.close()
      httpServer.off('upgrade', normalizeHost)
      const index = server.middlewares.stack.indexOf(tunnelLayer)
      if (index >= 0) server.middlewares.stack.splice(index, 1)
      detach()
      await gateway.close()
      closers.delete(close)
    }
    closers.add(close)
    server.middlewares.use((request, response, next) => {
      void gateway.middleware(request, response, next)
    })
    server.httpServer.once('close', () => {
      void close()
    })
  }
  return {
    name: 'voltio-websocket-receiver',
    configureServer: configure,
    configurePreviewServer: configure,
    closeBundle: async () => {
      await Promise.all([...closers].map((close) => close()))
    },
  }
}
