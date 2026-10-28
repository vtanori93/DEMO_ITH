import { test, expect } from '@playwright/test'

test('rutas directas, recarga, enlaces antiguos y redirección de rutas desconocidas', async ({ page }) => {
  for (const [path, title] of [
    ['/monitor', 'Monitor de variables'],
    ['/connection', 'Conecta tu dispositivo'],
    ['/protocol', 'Un lenguaje en común'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await page.goto(`/#${path.slice(1)}`)
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  }
  for (const path of ['/login', '/no-existe', '/ruta/anidada', '/login.html', '/login?from=prueba#detalle']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/monitor(?:#.*)?$/)
    await expect(page.getByRole('heading', { name: 'Monitor de variables', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Monitor', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByText('Página no encontrada', { exact: true })).toHaveCount(0)
  }
})

test('guard de configuración: bloquea sin receptor y se recupera sin recargar', async ({ page }) => {
  let available = false
  await page.route('**/api/gateway/status', async (route) => {
    if (available) await route.continue()
    else await route.fulfill({ status: 503, json: { error: 'Receptor detenido' } })
  })
  await page.goto('/connection')
  await expect(page.getByRole('heading', { name: 'Receptor no disponible' })).toBeVisible()
  await expect(page.getByLabel('Identificador del ESP32')).toHaveCount(0)
  available = true
  await expect(page.getByLabel('Identificador del ESP32')).toBeVisible()
  await expect(page).toHaveURL(/\/connection$/)
})

test('guard de salida permite conservar o descartar cambios sin guardar', async ({ page }) => {
  await page.goto('/connection')
  const device = page.getByLabel('Identificador del ESP32')
  const initial = await device.inputValue()
  await device.fill('cambio-sin-guardar')
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tienes cambios sin guardar' })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/connection$/)
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click()
  await expect(device).toHaveValue('cambio-sin-guardar')
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(device).toHaveValue('cambio-sin-guardar')
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  await page.getByRole('button', { name: 'Salir sin guardar', exact: true }).click()
  await expect(page).toHaveURL(/\/monitor$/)
  await page.getByRole('link', { name: 'Conexión', exact: true }).click()
  await expect(device).toHaveValue(initial)
  await device.fill('cambio-temporal')
  await device.fill(initial)
  await page.getByRole('link', { name: 'Protocolo de datos', exact: true }).click()
  await expect(page).toHaveURL(/\/protocol$/)
  await expect(dialog).toBeHidden()
})

test('la navegación conserva el socket de telemetría y el historial de rutas', async ({ page }) => {
  const sockets: string[] = []
  page.on('websocket', (socket) => sockets.push(socket.url()))
  await page.goto('/monitor')
  await expect(page.getByRole('heading', { name: 'Monitor de variables', exact: true })).toBeVisible()
  await expect(page.getByTestId('connection-status')).toHaveText('Conectado')
  const initialSockets = sockets.filter((url) => url.endsWith('/ws/monitor')).length
  expect(initialSockets).toBe(1)
  await page.getByRole('link', { name: 'Conexión', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Conecta tu dispositivo', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Protocolo de datos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Un lenguaje en común', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/connection$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/monitor$/)
  expect(sockets.filter((url) => url.endsWith('/ws/monitor'))).toHaveLength(initialSockets)
})

test('guard de recarga avisa antes de perder una edición', async ({ page }) => {
  await page.goto('/connection')
  await page.getByLabel('Identificador del ESP32').fill('cambio-pendiente')
  let unloadType = ''
  page.once('dialog', async (dialog) => {
    unloadType = dialog.type()
    await dialog.accept()
  })
  await page.reload()
  expect(unloadType).toBe('beforeunload')
  await expect(page.getByLabel('Identificador del ESP32')).not.toHaveValue('cambio-pendiente')
})

test('el guard de cambios funciona con el menú móvil y libera el bloqueo del fondo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/connection')
  await page.getByLabel('Identificador del ESP32').fill('edicion-movil')
  await page.getByRole('button', { name: 'Abrir menú de navegación' }).click()
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Tienes cambios sin guardar' })
  await expect(confirmation).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Menú de navegación' })).toBeHidden()
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden')
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click()
  await expect(confirmation).toBeHidden()
  await expect(page.getByLabel('Identificador del ESP32')).toHaveValue('edicion-movil')
  await page.getByRole('button', { name: 'Abrir menú de navegación' }).click()
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  await expect(confirmation).toBeVisible()
  await page.getByRole('button', { name: 'Salir sin guardar', exact: true }).click()
  await expect(page).toHaveURL(/\/monitor$/)
  await expect(page.getByRole('dialog', { name: 'Menú de navegación' })).toBeHidden()
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('')
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden')
})

test('un fallo de renderizado conserva la navegación y permite recargar', async ({ page }) => {
  await page.goto('/protocol')
  await expect(page.getByRole('heading', { name: 'Un lenguaje en común' })).toBeVisible()
  await page.evaluate(() => {
    window.ResizeObserver = class extends ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super(callback)
        throw new Error('Fallo de renderizado de prueba')
      }
    }
  })
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No pudimos abrir esta vista' })).toBeVisible()
  await page.getByRole('button', { name: 'Volver a cargar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Monitor de variables', exact: true })).toBeVisible()
})
