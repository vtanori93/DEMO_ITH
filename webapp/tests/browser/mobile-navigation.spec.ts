import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Monitor de variables' })).toBeVisible()
  await expect(page.locator('article')).toHaveCount(3)
  await page.evaluate(() => document.fonts.ready)
})

test('menú personalizado, sección actual, foco y cierre al tocar fuera', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Abrir menú de navegación' })
  await expect(trigger).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Menú de navegación' })
  await expect(dialog).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(dialog.getByRole('link', { name: 'Monitor', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(dialog.getByRole('button', { name: 'Cerrar menú' })).toBeFocused()
  expect(await page.evaluate(() => document.body.style.position)).toBe('fixed')
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.mouse.click(3, 120)
  await expect(dialog).toBeHidden()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => document.body.style.position)).toBe('')
})

test('Escape y selección de sección cierran el panel y restauran el foco', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Abrir menú de navegación' })
  await trigger.click()
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('link', { name: 'Conexión', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Conecta tu dispositivo' })).toBeVisible()
  await expect(page.locator('main')).toBeFocused()
  await trigger.click()
  await expect(page.getByRole('link', { name: 'Conexión', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.getByRole('button', { name: 'Cerrar menú' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('conserva el desplazamiento al cerrar y libera el bloqueo al pasar a escritorio', async ({
  page,
  isMobile,
}) => {
  await page.evaluate(() => scrollTo(0, 400))
  const position = await page.evaluate(() => scrollY)
  expect(position).toBeGreaterThan(0)
  const trigger = page.getByRole('button', { name: 'Abrir menú de navegación' })
  // Una pulsación real no ejecuta el scrollIntoView de locator.click sobre la cabecera sticky.
  const bounds = await trigger.boundingBox()
  if (!bounds) throw new Error('El botón de menú no está visible.')
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  if (isMobile) await page.touchscreen.tap(point.x, point.y)
  else await page.mouse.click(point.x, point.y)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(position)
  await trigger.click()
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(trigger).toBeHidden()
  await expect(
    page.getByRole('navigation', { name: 'Navegación principal', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('panel utilizable en pantalla pequeña, horizontal y texto ampliado', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'Abrir menú de navegación' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    )
    await dialog.getByRole('link', { name: 'Protocolo de datos' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Un lenguaje en común' })).toBeVisible()
  }
  await page.setViewportSize({ width: 320, height: 740 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  await page.getByRole('button', { name: 'Abrir menú de navegación' }).click()
  const dialog = page.getByRole('dialog')
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await dialog.getByRole('link', { name: 'Conexión', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Conecta tu dispositivo' })).toBeVisible()
})
