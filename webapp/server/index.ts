import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { createGateway } from './gateway.ts'
import { APP_PATHS } from '../src/shared/contracts/navigation.ts'
import { isRecord } from '../src/shared/lib/guards.ts'
import { createNgrokDiscovery } from './ngrok-discovery.ts'
import type { NgrokDiscoveryOptions } from './ngrok-discovery.ts'
import { getPublicOrigin } from '../config/network.ts'

interface ApplicationOptions {
  port?: number
  host?: string
  directory?: string
  configFile?: string
  ngrok?: Omit<NgrokDiscoveryOptions, 'getPort'>
  publicOrigin?: string
}

export async function startApplication({
  port = Number(process.env.PORT || 5173),
  host = process.env.HOST || '0.0.0.0',
  directory = resolve('dist'),
  configFile = process.env.VOLTIO_GATEWAY_CONFIG || resolve('.voltio/gateway.json'),
  ngrok = {},
  publicOrigin = process.env.NGROK_URL ?? '',
}: ApplicationOptions = {}) {
  const environmentPublicOrigin = getPublicOrigin(publicOrigin)
  let actualPort: number | null = null
  const discovery = createNgrokDiscovery({ ...ngrok, getPort: () => actualPort })
  const gateway = await createGateway({
    configFile: configFile === ':memory:' ? null : configFile,
    getDetectedPublicOrigin: discovery.getOrigin,
    environmentPublicOrigin,
  })
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  }
  const root = resolve(directory)
  const server = createServer((request, response) => {
    void gateway.middleware(request, response, () => {
      void (async () => {
        try {
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405)
            response.end()
            return
          }
          const pathname = decodeURIComponent(
            new URL(request.url ?? '/', 'http://localhost').pathname,
          )
          let file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`)
          if (!file.startsWith(`${root}${sep}`)) {
            response.writeHead(403)
            response.end()
            return
          }
          const fileInfo = await stat(file).catch((error: unknown) => {
            if (isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return null
            throw error
          })
          let statusCode = 200
          if (!fileInfo?.isFile()) {
            const knownRoute = Object.values(APP_PATHS).some((path) => path === pathname.replace(/\/$/, ''))
            const documentRoute = !extname(pathname) &&
              !/^\/(?:api|ws)(?:\/|$)/.test(pathname) &&
              request.headers.accept?.includes('text/html')
            if (!knownRoute && !documentRoute) {
              response.writeHead(404)
              response.end('Recurso no disponible.')
              return
            }
            file = resolve(root, 'index.html')
            statusCode = knownRoute ? 200 : 404
          }
          const content = await readFile(file)
          response.writeHead(statusCode, {
            'content-type': types[extname(file)] || 'application/octet-stream',
            'cache-control': 'no-cache',
          })
          response.end(request.method === 'HEAD' ? undefined : content)
        } catch {
          response.writeHead(404)
          response.end('Recurso no disponible. Ejecuta npm run build antes de npm start.')
        }
      })()
    })
  })
  const detach = gateway.attach(server)
  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
    else socket.destroy()
  })
  server.headersTimeout = 10_000
  server.requestTimeout = 15_000
  await new Promise<void>((done, reject) => {
    server.once('error', reject)
    server.listen(port, host, done)
  })
  const address = server.address()
  actualPort = address && typeof address !== 'string' ? address.port : null
  void discovery.refresh()
  return {
    server,
    gateway,
    close: async () => {
      discovery.close()
      detach()
      await gateway.close()
      await new Promise<void>((done) => server.close(() => done()))
    },
  }
}

if (import.meta.main) {
  const application = await startApplication()
  const address = application.server.address()
  if (!address || typeof address === 'string') throw new Error('No se pudo obtener el puerto.')
  console.log(
    `Voltio: http://localhost:${address.port} · receptor WebSocket activo`,
  )
  process.send?.({ type: 'ready', port: address.port, host: address.address })
  const stop = () => {
    void application.close().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}
