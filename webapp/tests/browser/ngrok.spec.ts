import { test, expect } from '@playwright/test'
import { createServer as createHttpsServer } from 'node:https'
import { createServer as createHttpServer, request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Duplex } from 'node:stream'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer, preview } from 'vite'
import react from '@vitejs/plugin-react'
import type { ViteDevServer } from 'vite'
import { WebSocket, WebSocketServer } from 'ws'
import { gatewayPlugin } from '../../server/vite-gateway.ts'
import { websocketText } from '../../server/websocket-data.ts'
import { isRecord } from '../../src/shared/lib/guards.ts'
import { parseGatewayStatus } from '../../src/shared/contracts/gateway.ts'

let workspace: string
let vite: ViteDevServer
let tlsServer: ReturnType<typeof createHttpsServer>
let publicUrl: string
let upstreamPort: number
let agentServer: ReturnType<typeof createHttpServer>
let discoverable = true
let includePublicHost = true
const publicHost = 'voltio-test.ngrok-free.dev'
const bridges = new Set<WebSocket>()
const connections = new Set<Duplex>()
const frontSockets = new WebSocketServer({ noServer: true })

test.beforeAll(async () => {
  process.env.VOLTIO_GATEWAY_CONFIG = ':memory:'
  workspace = await mkdtemp(join(tmpdir(), 'voltio-tunnel-test-'))
  const keyPath = join(workspace, 'test-key.pem'),
    certPath = join(workspace, 'test-cert.pem')
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
    ],
    { stdio: 'ignore' },
  )
  agentServer = createHttpServer((_request, response) => {
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ endpoints: discoverable ? [
      ...(publicUrl ? [{ url: publicUrl, upstream: { url: `http://localhost:${upstreamPort}` } }] : []),
      ...(includePublicHost ? [{ url: `https://${publicHost}`, upstream: { url: `http://localhost:${upstreamPort}` } }] : []),
      { url: 'https://otro.ngrok-free.dev', upstream: { url: 'http://localhost:8000' } },
    ] : [] }))
  })
  await new Promise<void>((resolve) => agentServer.listen(0, '127.0.0.1', resolve))
  vite = await createServer({
    configFile: false,
    root: resolve('.'),
    plugins: [react(), gatewayPlugin({
      agentOrigin: `http://127.0.0.1:${(agentServer.address() as AddressInfo).port}`,
      intervalMs: 100,
    })],
    cacheDir: join(workspace, 'vite-cache'),
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      allowedHosts: [],
    },
  })
  await vite.listen()
  const address = vite.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite no tiene un puerto activo.')
  upstreamPort = address.port
  // ngrok http 5173 conserva Host. La aplicación debe admitir el dominio detectado.
  const host = publicHost
  tlsServer = createHttpsServer(
    { key: await readFile(keyPath), cert: await readFile(certPath) },
    (request, response) => {
      const upstream = httpRequest(
        {
          hostname: '127.0.0.1',
          port: upstreamPort,
          method: request.method,
          path: request.url,
          headers: { ...request.headers, host, 'x-forwarded-proto': 'https' },
        },
        (result) => {
          response.writeHead(result.statusCode ?? 502, result.headers)
          result.pipe(response)
        },
      )
      upstream.on('error', () => {
        response.writeHead(502)
        response.end()
      })
      request.pipe(upstream)
    },
  )
  tlsServer.on('connection', (socket) => {
    connections.add(socket)
    socket.on('close', () => connections.delete(socket))
  })
  // El puente de prueba termina TLS como ngrok y conserva protocolo, ruta y Origin.
  tlsServer.on('upgrade', (request, socket, head) => {
    const protocols =
      request.headers['sec-websocket-protocol']?.split(',').map((value) => value.trim()) ?? []
    const upstream = new WebSocket(`ws://127.0.0.1:${upstreamPort}${request.url}`, protocols, {
      headers: { host, ...(request.headers.origin ? { origin: request.headers.origin } : {}) },
    })
    bridges.add(upstream)
    upstream.once('open', () => {
      frontSockets.handleUpgrade(request, socket, head, (client) => {
        client.on('message', (data, binary) => {
          if (upstream.readyState === 1) upstream.send(data, { binary })
        })
        upstream.on('message', (data, binary) => {
          if (client.readyState === 1) client.send(data, { binary })
        })
        client.on('close', () => upstream.close())
        client.on('error', () => upstream.terminate())
        upstream.on('close', () => client.close())
      })
    })
    upstream.on('error', () => socket.destroy())
    upstream.on('unexpected-response', () => socket.destroy())
    upstream.once('close', () => bridges.delete(upstream))
  })
  await new Promise<void>((resolve) => tlsServer.listen(0, '127.0.0.1', resolve))
  publicUrl = `https://127.0.0.1:${(tlsServer.address() as AddressInfo).port}`
})

test.afterAll(async () => {
  for (const socket of frontSockets.clients) socket.terminate()
  for (const socket of bridges) socket.terminate()
  for (const socket of connections) socket.destroy()
  frontSockets.close()
  if (tlsServer) await new Promise<void>((resolve) => tlsServer.close(() => resolve()))
  if (vite) await vite.close()
  if (agentServer) await new Promise<void>((resolve) => agentServer.close(() => resolve()))
  if (workspace) await rm(workspace, { recursive: true, force: true })
})

test('Vite acepta el dominio detectado sin política ni NGROK_HOST y rechaza otros hosts', async ({ request }) => {
  const url = `http://127.0.0.1:${upstreamPort}`
  expect(
    (await request.get(url, { headers: { Host: publicHost } })).status(),
  ).toBe(200)
  expect((await request.get(url, { headers: { Host: 'unknown.example' } })).status()).toBe(403)
  expect((await request.get(url, { headers: { Host: 'otro.ngrok-free.dev' } })).status()).toBe(403)
  includePublicHost = false
  await expect.poll(async () => (await request.get(url, { headers: { Host: publicHost } })).status()).toBe(403)
  includePublicHost = true
  expect((await request.get(url, { headers: { Host: publicHost } })).status()).toBe(200)
})

test('localhost cambia de la dirección de red a WSS al iniciar ngrok sin recargar', async ({ page, request }) => {
  const local = `http://127.0.0.1:${upstreamPort}`
  discoverable = false
  try {
    await expect.poll(async () => parseGatewayStatus(await (await request.get(`${local}/api/gateway/status`)).json()).detectedPublicOrigin).toBe(null)
    await page.goto(`${local}/connection`)
    await expect(page.getByTestId('sender-url')).toHaveValue(/^ws:\/\//)
    discoverable = true
    await expect(page.getByTestId('sender-url')).toHaveValue(`${publicUrl.replace('https:', 'wss:')}/ws/esp32?device=esp32-01`)
    await expect(page.getByTestId('public-webapp-url')).toHaveAttribute('href', `${publicUrl}/connection`)
    await expect(page.getByText('Ngrok detectado · web y WebSocket en el mismo túnel')).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally { discoverable = true }
})

test('HTTPS comparte página, HMR y recepción de un ESP32 por un único origen', async ({
  browser,
}) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  let sender: WebSocket | null = null
  try {
    const page = await context.newPage()
    const sockets: string[] = [],
      messages: string[] = [],
      errors: string[] = []
    page.on('websocket', (socket) => sockets.push(socket.url()))
    page.on('console', (message) => messages.push(message.text()))
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(publicUrl)
    await expect(page.getByLabel('Dirección de recepción para el ESP32')).toHaveValue(
      `${publicUrl.replace('https:', 'wss:')}/ws/esp32?device=esp32-01`,
    )
    await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
    const device = new WebSocket(`${publicUrl.replace('https:', 'wss:')}/ws/esp32?device=esp32-01`, {
      rejectUnauthorized: false,
    })
    sender = device
    await new Promise<void>((resolve, reject) => {
      device.once('open', resolve)
      device.once('error', reject)
    })
    sender.send('{"temperature":1.25,"voltage":2.50,"current":3.75}')
    await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
    for (const [channel, value] of [
      ['temperature', '1.25'],
      ['voltage', '2.50'],
      ['current', '3.75'],
    ] as const)
      await expect(page.getByTestId(`value-${channel}`)).toHaveText(value)
    expect(sockets).toContain(`${publicUrl.replace('https:', 'wss:')}/ws/monitor`)
    expect(sockets.every((url) => url.startsWith('wss://'))).toBe(true)
    await expect
      .poll(() => messages.some((message) => message.includes('[vite] connected.')))
      .toBe(true)
    expect(errors).toEqual([])
    await page.goto(`${publicUrl}/connection`)
    await page.getByText('Conexión del monitor · opciones avanzadas', { exact: true }).click()
    await page.getByRole('button', { name: 'Desconectar', exact: true }).click()
    await page.getByLabel('Dirección WebSocket').fill('ws://192.168.4.1/ws')
    await page.getByRole('button', { name: 'Conectar monitor', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Esta página usa HTTPS')
  } finally {
    sender?.terminate()
    await context.close()
  }
})

test('preview incluye el receptor y distribuye los valores a su monitor', async () => {
  const root = join(workspace, 'preview')
  await mkdir(join(root, 'dist'), { recursive: true })
  await writeFile(join(root, 'dist/index.html'), '<!doctype html><title>Preview de prueba</title>')
  const server = await preview({
    configFile: false,
    plugins: [gatewayPlugin()],
    root,
    logLevel: 'error',
    preview: { host: '127.0.0.1', port: 0, strictPort: false },
  })
  const port = (server.httpServer.address() as AddressInfo).port
  const monitor = new WebSocket(`ws://127.0.0.1:${port}/ws/monitor`)
  const sender = new WebSocket(`ws://127.0.0.1:${port}/ws/esp32?device=esp32-01`)
  try {
    const received = new Promise<string>((resolve, reject) => {
      monitor.once('message', (data) => resolve(websocketText(data)))
      monitor.once('error', reject)
    })
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        monitor.once('open', resolve)
        monitor.once('error', reject)
      }),
      new Promise<void>((resolve, reject) => {
        sender.once('open', resolve)
        sender.once('error', reject)
      }),
    ])
    sender.send('{"temperature":0,"voltage":2.5,"current":5}')
    const frame: unknown = JSON.parse(await received)
    if (!isRecord(frame)) throw new Error('El receptor no devolvió una trama válida.')
    expect(frame.values).toEqual({ temperature: 0, voltage: 2.5, current: 5 })
  } finally {
    monitor.terminate()
    sender.terminate()
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()))
  }
})

test('la recepción también se configura desde el panel a través de HTTPS', async ({ browser }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  let sender: WebSocket | null = null
  try {
    const page = await context.newPage()
    await page.goto(`${publicUrl}/connection`)
    await page.getByLabel('Identificador del ESP32').fill('arduino-tls')
    await page.getByLabel('Ruta de recepción').fill('/ws/remoto')
    await page.getByLabel('URL pública o dirección de la aplicación').fill(publicUrl)
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    const endpoint = `${publicUrl.replace('https:', 'wss:')}/ws/remoto?device=arduino-tls`
    await expect(page.getByTestId('sender-url')).toHaveValue(endpoint)
    await page.getByRole('button', { name: 'Ver datos en el monitor' }).click()
    const device = new WebSocket(endpoint, { rejectUnauthorized: false })
    sender = device
    await new Promise<void>((resolve, reject) => {
      device.once('open', resolve)
      device.once('error', reject)
    })
    sender.send('{"temperature":0.75,"voltage":2.25,"current":4.50}')
    await expect(page.getByTestId('value-temperature')).toHaveText('0.75')
    await expect(page.getByTestId('value-voltage')).toHaveText('2.25')
    await expect(page.getByTestId('value-current')).toHaveText('4.50')
  } finally {
    sender?.terminate()
    await context.close()
  }
})
