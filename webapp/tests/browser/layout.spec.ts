import { test, expect } from '@playwright/test'

test('el header permanece visible al desplazarse en escritorio, móvil y horizontal', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/monitor')
    await expect(page.getByRole('heading', { name: 'Monitor de variables' })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const header = page.getByRole('banner')
    const initial = await header.boundingBox()
    expect(initial?.y).toBeCloseTo(0)
    await page.evaluate(() => scrollTo(0, 600))
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
    const scrolled = await header.boundingBox()
    expect(scrolled?.y).toBeCloseTo(0)
    await expect(header).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('el sidebar se colapsa, recuerda la preferencia y conserva la sesión y los márgenes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/monitor')
  const sidebar = page.getByRole('complementary', { name: 'Barra lateral' })
  const expanded = await sidebar.boundingBox()
  if (!expanded) throw new Error('No se encontró la barra lateral.')
  await page.getByRole('button', { name: 'Probar demo', exact: true }).click()
  await expect(page.getByTestId('value-temperature')).not.toHaveText('—')
  const received = Number(await page.getByTestId('valid-messages').innerText())
  await page.getByRole('button', { name: 'Colapsar barra lateral' }).click()
  const expand = page.getByRole('button', { name: 'Expandir barra lateral' })
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  const collapsed = await sidebar.boundingBox()
  if (!collapsed) throw new Error('No se encontró la barra colapsada.')
  expect(collapsed.width).toBeLessThan(expanded.width / 2)
  await expect(sidebar.getByRole('link', { name: 'Monitor', exact: true })).toHaveAttribute('title', 'Monitor')
  await sidebar.getByRole('link', { name: 'Protocolo de datos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Un lenguaje en común', exact: true })).toBeVisible()
  await expect(page.getByTestId('connection-status')).toHaveText('Simulación')
  await sidebar.getByRole('link', { name: 'Monitor', exact: true }).click()
  await expect.poll(async () => Number(await page.getByTestId('valid-messages').innerText())).toBeGreaterThan(received)
  const margins = await page.locator('main').evaluate((main) => {
    const content = main.firstElementChild?.getBoundingClientRect()
    const rail = document.getElementById('desktop-sidebar')?.getBoundingClientRect()
    if (!content || !rail) throw new Error('No se pudo medir el contenido.')
    return { left: content.left - rail.right, right: innerWidth - content.right }
  })
  expect(margins).toEqual({ left: 24, right: 24 })
  await page.reload()
  await expect(expand).toBeVisible()
  expect((await sidebar.boundingBox())?.width).toBeCloseTo(collapsed.width)
  await expand.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Colapsar barra lateral' })).toHaveAttribute('aria-expanded', 'true')
  expect((await sidebar.boundingBox())?.width).toBeCloseTo(expanded.width)
})

test('el badge se lee y permanece dentro del enlace en todos los estados del sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/connection')
  const sidebar = page.getByRole('complementary', { name: 'Barra lateral' })
  const monitor = sidebar.getByRole('link', { name: 'Monitor', exact: true })
  const badge = monitor.getByText('3', { exact: true })
  for (const state of ['expanded-inactive', 'expanded-active', 'collapsed-active', 'collapsed-inactive']) {
    if (state === 'expanded-active') await monitor.click()
    if (state === 'collapsed-active') await page.getByRole('button', { name: 'Colapsar barra lateral' }).click()
    if (state === 'collapsed-inactive') await sidebar.getByRole('link', { name: 'Conexión', exact: true }).click()
    await expect(badge).toBeVisible()
    const bounds = await badge.boundingBox()
    const item = await monitor.boundingBox()
    if (!bounds || !item) throw new Error('No se pudo medir el badge.')
    expect(bounds.x).toBeGreaterThanOrEqual(item.x)
    expect(bounds.y).toBeGreaterThanOrEqual(item.y)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(item.x + item.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(item.y + item.height)
    if (state.startsWith('expanded'))
      expect(Math.abs(bounds.y + bounds.height / 2 - item.y - item.height / 2)).toBeLessThan(0.5)
    const contrast = await badge.evaluate((element) => {
      const luminance = (color: string) => {
        const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? []
        return channels.reduce((sum, value, index) => {
          const normalized = value / 255
          const linear = normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
          return sum + linear * ([0.2126, 0.7152, 0.0722][index] ?? 0)
        }, 0)
      }
      const styles = getComputedStyle(element)
      const foreground = luminance(styles.color)
      const background = luminance(styles.backgroundColor)
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
    })
    expect(contrast).toBeGreaterThanOrEqual(4.5)
  }
})

test('colapsar en escritorio mantiene el menú móvil y restaura la barra al volver', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/monitor')
  await page.getByRole('button', { name: 'Colapsar barra lateral' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('complementary', { name: 'Barra lateral' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Expandir barra lateral' })).toBeHidden()
  await expect(page.getByRole('link', { name: 'Voltio, ir al monitor' })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir menú de navegación' }).click()
  await page.getByRole('link', { name: 'Conexión', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Menú de navegación' })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Conecta tu dispositivo' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('button', { name: 'Expandir barra lateral' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Barra lateral' })).toBeVisible()
})
