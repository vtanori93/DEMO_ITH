import { test, expect } from '@playwright/test'

const viewports = [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
  { width: 1440, height: 1000 },
]

for (const viewport of viewports) {
  test(`tres vistas sin desbordamiento a ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    for (const [hash, heading] of [
      ['monitor', 'Monitor de variables'],
      ['connection', 'Conecta tu dispositivo'],
      ['protocol', 'Un lenguaje en común'],
    ] as const) {
      await page.goto(`/${hash}`)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      const smallControls = await page
        .locator('button:visible, nav a:visible')
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              const { width, height } = element.getBoundingClientRect()
              return width < 43.9 || height < 43.9
            })
            .map((element) => ({
              text: element.textContent,
              width: element.getBoundingClientRect().width,
              height: element.getBoundingClientRect().height,
            })),
        )
      expect(smallControls, 'controles táctiles de al menos 44 × 44 píxeles').toEqual([])
      expect(
        await page
          .locator('input:visible')
          .evaluateAll((elements) =>
            elements.every((element) => parseFloat(getComputedStyle(element).fontSize) >= 16),
          ),
      ).toBe(true)
    }
  })
}

test('la sesión continúa al navegar y permite volver con el historial del navegador', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Probar demo', exact: true }).click()
  await expect(page.getByTestId('value-temperature')).not.toHaveText('—')
  const initialCount = Number(await page.getByTestId('valid-messages').innerText())
  await page.getByRole('button', { name: 'Abrir menú de navegación' }).click()
  await page.getByRole('link', { name: 'Conexión', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Menú de navegación' })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Conecta tu dispositivo' })).toBeVisible()
  await expect(page.getByTestId('connection-status')).toHaveText('Simulación')
  await page.getByRole('button', { name: 'Abrir menú de navegación' }).click()
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Menú de navegación' })).toBeHidden()
  await expect
    .poll(async () => Number(await page.getByTestId('valid-messages').innerText()))
    .toBeGreaterThan(initialCount)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Conecta tu dispositivo' })).toBeVisible()
})

test('texto ampliado al 200 %, tipografía Candara y navegación por teclado', async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Monitor de variables' })).toBeVisible()
  await page.evaluate(async () => {
    document.documentElement.style.fontSize = '200%'
    await document.fonts.load('400 16px Candara')
    await document.fonts.load('700 16px Candara')
  })
  for (const hash of ['monitor', 'connection', 'protocol']) {
    await page.goto(`/${hash}`)
    await expect(page.locator('h1')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const fonts = await page
      .locator('h1, h2, button, input, code, svg text')
      .evaluateAll((elements) =>
        elements.every((element) => getComputedStyle(element).fontFamily.includes('Candara')),
      )
    expect(fonts).toBe(true)
  }
  await page.goto('/')
  if (isMobile) await page.getByRole('link', { name: 'Saltar al contenido' }).focus()
  else await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
})
