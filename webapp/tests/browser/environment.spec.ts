import { test, expect } from '@playwright/test'
import { fork } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { WebSocket } from 'ws'
import { isRecord } from '../../src/shared/lib/guards.ts'
import { parseGatewayStatus } from '../../src/shared/contracts/gateway.ts'

test('cambiar .env actualiza el panel y los hosts de HTTP y WebSocket sin editar ni compilar React', async ({ page, request }) => {
  const root = await mkdtemp(join(tmpdir(), 'voltio-env-'))
  const runner = join(root, 'run-vite.mjs')
  const ngrokHostnames = ['primero-env.ngrok-free.dev', 'segundo-env.ngrok-free.dev']
  await mkdir(join(root, '.voltio'))
  await writeFile(join(root, '.voltio/gateway.json'), JSON.stringify({
    senderPath: '/ws/prueba', deviceId: 'esp32-env', enabled: true,
    publicOrigin: 'https://dominio-anterior.ngrok-free.dev',
  }))
  await writeFile(runner, `
    import { createServer } from ${JSON.stringify(pathToFileURL(resolve('node_modules/vite/dist/node/index.js')).href)}
    const server = await createServer({
      configFile: ${JSON.stringify(resolve('vite.config.ts'))},
      root: ${JSON.stringify(resolve('.'))},
      envDir: ${JSON.stringify(root)},
      cacheDir: ${JSON.stringify(join(root, 'cache'))},
      logLevel: 'error',
      server: { host: '127.0.0.1', port: 0, strictPort: false },
    })
    await server.listen()
    process.send({ port: server.httpServer.address().port })
    process.once('SIGTERM', () => { void server.close().then(() => process.exit(0)) })
  `)
  try {
    for (const hostname of ngrokHostnames) {
      await writeFile(join(root, '.env'), `NGROK_URL=https://${hostname}\n`)
      const env: NodeJS.ProcessEnv = { ...process.env, VOLTIO_GATEWAY_CONFIG: join(root, '.voltio/gateway.json') }
      delete env.NGROK_URL
      delete env.NGROK_HOST
      const child = fork(runner, [], { cwd: root, env, execArgv: [], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] })
      let sender: WebSocket | null = null
      try {
        const port = await new Promise<number>((resolve, reject) => {
          child.once('error', reject)
          child.once('exit', (code) => reject(new Error(`Vite terminó antes de iniciar: ${code}`)))
          child.once('message', (value: unknown) => {
            if (isRecord(value) && typeof value.port === 'number') resolve(value.port)
            else reject(new Error('Vite no informó su puerto.'))
          })
        })
        const base = `http://127.0.0.1:${port}`
        const status = parseGatewayStatus(await (await request.get(`${base}/api/gateway/status`)).json())
        expect(status.environmentPublicOrigin).toBe(`https://${hostname}`)
        expect((await request.get(base, { headers: { Host: hostname } })).status()).toBe(200)
        expect((await request.get(base, { headers: { Host: 'dominio-anterior.ngrok-free.dev' } })).status()).toBe(403)
        const previous = ngrokHostnames.find((value) => value !== hostname)
        if (previous) expect((await request.get(base, { headers: { Host: previous } })).status()).toBe(403)
        await page.goto(`${base}/connection`)
        await expect(page.getByLabel('URL pública o dirección de la aplicación')).toHaveValue(`https://${hostname}`)
        await expect(page.getByLabel('URL pública o dirección de la aplicación')).toHaveAttribute('readonly', '')
        await expect(page.getByTestId('sender-url')).toHaveValue(`wss://${hostname}/ws/prueba?device=esp32-env`)
        await expect(page.getByTestId('public-webapp-url')).toHaveAttribute('href', `https://${hostname}/connection`)
        await page.setViewportSize({ width: 390, height: 844 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await page.getByRole('button', { name: 'Ver datos en el monitor' }).click()
        const device = new WebSocket(`ws://127.0.0.1:${port}/ws/prueba?device=esp32-env`, { headers: { Host: hostname } })
        sender = device
        await new Promise<void>((resolve, reject) => { device.once('open', resolve); device.once('error', reject) })
        device.send('{"temperature":24.5,"voltage":11.25,"current":8.75}')
        await expect(page.getByTestId('value-temperature')).toHaveText('24.50')
        await expect(page.getByTestId('value-voltage')).toHaveText('11.25')
        await expect(page.getByTestId('value-current')).toHaveText('8.75')
      } finally {
        sender?.terminate()
        if (child.exitCode === null && child.signalCode === null) {
          const stopped = new Promise<void>((resolve) => child.once('exit', () => resolve()))
          child.kill('SIGTERM')
          const forceStop = setTimeout(() => child.kill('SIGKILL'), 3_000)
          try { await stopped } finally { clearTimeout(forceStop) }
        }
      }
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})
