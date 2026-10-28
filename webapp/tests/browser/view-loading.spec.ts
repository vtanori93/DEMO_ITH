import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { once } from 'node:events'
import { WebSocket } from 'ws'

async function navigate(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Abrir menú de navegación' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('link', { name, exact: true }).click()
}

test('una ruta desconocida vuelve al monitor sin recargar ni añadir otra entrada al historial', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/monitor$/)
  await expect(page.getByRole('heading', { name: 'Monitor de variables' })).toBeVisible()
  await navigate(page, 'Protocolo de datos')
  await expect(page.getByRole('heading', { name: 'Un lenguaje en común' })).toBeVisible()
  const startedAt = await page.evaluate(() => performance.timeOrigin)
  const initialHistory = await page.evaluate(() => history.length)
  await page.evaluate(() => {
    const state: unknown = history.state
    if (typeof state !== 'object' || state === null || !('idx' in state) || typeof state.idx !== 'number')
      throw new Error('Falta el índice de navegación de React Router.')
    history.pushState({ ...state, idx: state.idx + 1 }, '', '/login?from=prueba#detalle')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page).toHaveURL(/\/monitor$/)
  await expect(page.getByRole('heading', { name: 'Monitor de variables' })).toBeVisible()
  await expect(page.getByText('Página no encontrada', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(startedAt)
  expect(await page.evaluate(() => history.length)).toBe(initialHistory + 1)
  await page.goBack()
  await expect(page).toHaveURL(/\/protocol$/)
  await expect(page.getByRole('heading', { name: 'Un lenguaje en común' })).toBeVisible()
})

test('las vistas y la personalización siguen disponibles cuando falla la descarga de módulos', async ({ page }) => {
  const errors: string[] = []
  const downloads: string[] = []
  const sockets: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('websocket', (socket) => sockets.push(socket.url()))
  await page.goto('/monitor')
  await expect(page.getByRole('heading', { name: 'Monitor de variables' })).toBeVisible()
  await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
  await expect(page.getByLabel('Dirección de recepción para el ESP32')).not.toHaveValue('')
  // El documento ya abrió. La siguiente descarga de código o estilos falla,
  // como al perder cobertura o volver a una pestaña tras cambiar la versión.
  await page.route('**/*', async (route) => {
    if (['script', 'stylesheet'].includes(route.request().resourceType())) {
      downloads.push(route.request().url())
      await route.abort('connectionfailed')
    } else await route.continue()
  })

  await navigate(page, 'Protocolo de datos')
  await expect(page.getByRole('heading', { name: 'Un lenguaje en común' })).toBeVisible()
  await navigate(page, 'Conexión')
  await expect(page.getByRole('heading', { name: 'Conecta tu dispositivo' })).toBeVisible()
  await navigate(page, 'Monitor')
  await page.getByRole('button', { name: 'Personalizar indicadores', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Personalizar indicadores' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar personalización' }).click()
  await expect(page.getByRole('heading', { name: 'Monitor de variables' })).toBeVisible()
  expect(downloads).toEqual([])
  expect(errors).toEqual([])
  expect(sockets.filter((url) => url.endsWith('/ws/monitor'))).toHaveLength(1)
})

test('un corte de red y la vuelta a la pestaña conservan las vistas y la sesión', async ({ page, context }) => {
  await page.goto('/protocol')
  await expect(page.getByRole('heading', { name: 'Un lenguaje en común' })).toBeVisible()
  // Se obtiene el estado inicial antes del corte: la configuración puede
  // abrirse con la última respuesta válida aunque no haya red.
  await navigate(page, 'Conexión')
  await expect(page.getByRole('heading', { name: 'Conecta tu dispositivo' })).toBeVisible()
  await navigate(page, 'Protocolo de datos')
  const startedAt = await page.evaluate(() => performance.timeOrigin)
  await context.setOffline(true)
  try {
    await navigate(page, 'Monitor')
    await expect(page.getByRole('heading', { name: 'Monitor de variables' })).toBeVisible()
    await page.getByRole('button', { name: 'Personalizar indicadores', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Personalizar indicadores' })).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar personalización' }).click()
    await navigate(page, 'Conexión')
    await expect(page.getByRole('heading', { name: 'Conecta tu dispositivo' })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('pageshow'))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await navigate(page, 'Monitor')
  const device = new WebSocket('ws://127.0.0.1:5174/ws/esp32?device=esp32-01')
  try {
    await once(device, 'open', { signal: AbortSignal.timeout(2_000) })
    device.send('{"temperature":4.5,"voltage":2.5,"current":3.75}')
    await expect(page.getByTestId('value-temperature')).toHaveText('4.50')
    await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
  } finally {
    device.terminate()
  }
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(startedAt)
  await expect(page.getByRole('heading', { name: 'No pudimos abrir esta vista' })).toHaveCount(0)
})
