import { devices, expect, test, type BrowserContext, type CDPSession, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const DATABASE_NAME = 'chill-notes'

async function openCleanApp(page: Page) {
  await page.goto('/')
  await page.evaluate(async (databaseName) => {
    window.localStorage.clear()
    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(databaseName)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB cleanup was blocked.'))
    })
  }, DATABASE_NAME)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Note title' })).toBeVisible()
}

async function waitForServiceWorkerControl(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: 'domcontentloaded' })
  }

  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    { timeout: 15_000 },
  ).toBe(true)
}

async function stageWaitingUpdate(page: Page, context: BrowserContext) {
  const workerSource = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8')
  await context.route('**/pwa-bootstrap', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><title>PWA bootstrap</title>',
  }))
  await context.route('**/sw.js?fixture=old', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    headers: { 'Service-Worker-Allowed': '/' },
    body: `${workerSource}\n// fixture-old-worker`,
  }))

  await page.goto('/pwa-bootstrap')
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js?fixture=old', { scope: '/' })
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
      })
    }
  })

  await page.goto('/')
  await expect(page.getByText('A fresh version is ready')).toBeVisible({ timeout: 15_000 })
}

async function decodedImage(page: Page, source: string) {
  return page.evaluate(async (imageSource) => {
    const image = new Image()
    image.src = imageSource
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context?.drawImage(image, 0, 0)

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      cornerAlpha: context?.getImageData(0, 0, 1, 1).data[3] ?? 0,
    }
  }, source)
}

async function dispatchInstallPrompt(page: Page, outcome: 'accepted' | 'dismissed') {
  return page.evaluate((choice) => {
    const promptWindow = window as typeof window & { __pwaPromptCalls?: number }
    promptWindow.__pwaPromptCalls = 0

    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.defineProperties(event, {
      platforms: { value: ['web'] },
      prompt: {
        value: async () => {
          promptWindow.__pwaPromptCalls = (promptWindow.__pwaPromptCalls ?? 0) + 1
        },
      },
      userChoice: {
        value: Promise.resolve({ outcome: choice, platform: 'web' }),
      },
    })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }, outcome)
}

async function dispatchTouch(
  session: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  points: Array<{ id: number; x: number; y: number; force?: number }>,
) {
  await session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point) => ({
      ...point,
      radiusX: 4,
      radiusY: 4,
      force: point.force ?? 0.5,
    })),
  })
}

async function persistedDrawing(page: Page) {
  return page.evaluate(async (databaseName) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const stored = await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction('workspace', 'readonly')
      const request = transaction.objectStore('workspace').get('current')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()

    const workspace = JSON.parse(String(stored)) as {
      notes?: Array<{ drawing?: string }>
    }
    const drawing = workspace.notes?.[0]?.drawing
    if (!drawing) return null
    return JSON.parse(drawing) as {
      elements: Array<{
        type: string
        x: number
        y: number
        width: number
        height: number
        points?: Array<{ x: number; y: number; pressure: number }>
      }>
    }
  }, DATABASE_NAME)
}

test('publishes installable metadata and correctly sized app icons', async ({ page, request }) => {
  await page.goto('/')

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('viewport-fit=cover')

  const manifestResponse = await request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json')
  const manifest = await manifestResponse.json()
  expect(manifest).toMatchObject({
    id: '/',
    name: 'Chill Notes',
    short_name: 'Chill Notes',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8f2f3',
    theme_color: '#ad5870',
  })
  expect(manifest.icons).toEqual([
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ])

  for (const icon of manifest.icons as Array<{ src: string; sizes: string; purpose: string }>) {
    const response = await request.get(`/${icon.src}`)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('image/png')

    const size = Number(icon.sizes.split('x')[0])
    const decoded = await decodedImage(page, `/${icon.src}`)
    expect(decoded).toMatchObject({ width: size, height: size })
    if (icon.purpose === 'maskable') expect(decoded.cornerAlpha).toBe(255)
  }

  const appleIcon = await decodedImage(page, '/apple-touch-icon.png')
  expect(appleIcon).toMatchObject({ width: 180, height: 180, cornerAlpha: 255 })
  const favicon = await request.get('/favicon.svg')
  expect(favicon.ok()).toBe(true)
  expect(favicon.headers()['content-type']).toContain('image/svg+xml')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.evaluate(() => {
    const spinner = document.createElement('span')
    spinner.className = 'is-spinning'
    document.body.append(spinner)
    const animationName = getComputedStyle(spinner).animationName
    spinner.remove()
    return animationName
  })).toBe('none')
})

test('offers installation only after browser eligibility and clears it after installation', async ({ page }) => {
  await openCleanApp(page)

  await page.getByRole('button', { name: 'Workspace options' }).click()
  await expect(page.getByRole('menuitem', { name: 'Install Chill Notes' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  expect(await dispatchInstallPrompt(page, 'accepted')).toBe(true)
  await page.getByRole('button', { name: 'Workspace options' }).click()
  await page.getByRole('menuitem', { name: 'Install Chill Notes' }).click()
  await expect(page.locator('.toast')).toContainText('Chill Notes is being installed.')
  expect(await page.evaluate(() => (
    window as typeof window & { __pwaPromptCalls?: number }
  ).__pwaPromptCalls)).toBe(1)

  await page.getByRole('button', { name: 'Workspace options' }).click()
  await expect(page.getByRole('menuitem', { name: 'Install Chill Notes' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await dispatchInstallPrompt(page, 'dismissed')
  await page.getByRole('button', { name: 'Workspace options' }).click()
  await expect(page.getByRole('menuitem', { name: 'Install Chill Notes' })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await expect(page.getByRole('menuitem', { name: 'Install Chill Notes' })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.displayMode)).toBe('standalone')
})

test('gives iPhone and iPad users concise Add to Home Screen guidance', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    })
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'iPhone' })
  })
  await openCleanApp(page)

  await page.getByRole('button', { name: 'Workspace options' }).click()
  await page.getByRole('menuitem', { name: 'Add to Home Screen' }).click()
  await expect(page.locator('.toast')).toContainText('In Safari, tap Share, then “Add to Home Screen.”')
})

test('reloads saved notes and all critical assets from the service worker while offline', async ({ page, context }) => {
  await openCleanApp(page)
  await waitForServiceWorkerControl(page)

  await page.getByRole('textbox', { name: 'Note title' }).fill('Available without a connection')
  await expect.poll(async () => {
    const drawing = await persistedDrawing(page)
    if (drawing) return false
    return page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('chill-notes')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const stored = await new Promise<unknown>((resolve, reject) => {
        const request = database.transaction('workspace', 'readonly').objectStore('workspace').get('current')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      database.close()
      const workspace = JSON.parse(String(stored)) as { notes?: Array<{ title?: string }> }
      return workspace.notes?.some((note) => note.title === 'Available without a connection') ?? false
    })
  }).toBe(true)

  const cachedPaths = await page.evaluate(async () => {
    const requests = (await Promise.all((await caches.keys()).map(async (name) => (
      (await caches.open(name)).keys()
    )))).flat()
    return requests.map((request) => new URL(request.url).pathname)
  })
  expect(cachedPaths).toContain('/index.html')
  expect(cachedPaths).toContain('/manifest.webmanifest')
  expect(cachedPaths).toContain('/icons/icon-192.png')
  expect(cachedPaths).toContain('/icons/icon-maskable-512.png')
  expect(cachedPaths.some((path) => path.endsWith('.js'))).toBe(true)
  expect(cachedPaths.some((path) => path.endsWith('.css'))).toBe(true)
  expect(cachedPaths.some((path) => /\.woff2?$/.test(path))).toBe(true)

  const session = await context.newCDPSession(page)
  await session.send('Network.setCacheDisabled', { cacheDisabled: true })
  await context.setOffline(true)
  try {
    const response = await page.reload({ waitUntil: 'domcontentloaded' })
    expect(response?.fromServiceWorker()).toBe(true)
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Available without a connection')

    const offlineAssets = await page.evaluate(async () => {
      const paths = [
        '/manifest.webmanifest',
        '/favicon.svg',
        '/apple-touch-icon.png',
        '/icons/icon-192.png',
        '/icons/icon-maskable-512.png',
      ]
      return Promise.all(paths.map(async (path) => ({ path, ok: (await fetch(path)).ok })))
    })
    expect(offlineAssets.every((asset) => asset.ok)).toBe(true)

    await page.getByRole('tab', { name: 'Draw' }).click()
    await expect(page.getByRole('application', { name: /Editable drawing canvas/ })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

test('prompts for a real waiting-worker update and preserves notes through activation', async ({ page, context }) => {
  await stageWaitingUpdate(page, context)
  await page.getByRole('textbox', { name: 'Note title' }).fill('Survives the app update')

  const navigated = page.waitForEvent('framenavigated', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Update now' }).click()
  await navigated

  await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Survives the app update')
  await expect(page.getByText('A fresh version is ready')).toHaveCount(0)
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return {
      controller: navigator.serviceWorker.controller?.scriptURL ?? '',
      waiting: registration?.waiting?.scriptURL ?? '',
    }
  })).toEqual({ controller: 'http://127.0.0.1:4173/sw.js', waiting: '' })
})

test('does not reload an unsafe tab when another tab activates the update', async ({ page, context }) => {
  await stageWaitingUpdate(page, context)

  const unsafePage = await context.newPage()
  await unsafePage.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: { open: () => { throw new DOMException('Unavailable', 'InvalidStateError') } },
    })
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function setItemWithQuotaFailure(key, value) {
      if (key === 'chill-notes-v1') throw new DOMException('Full', 'QuotaExceededError')
      return setItem.call(this, key, value)
    }
  })
  await unsafePage.goto('/')
  await expect(unsafePage.getByRole('alert')).toContainText('Your latest changes are not saved')
  await expect(unsafePage.getByText('A fresh version is ready')).toBeVisible({ timeout: 15_000 })
  await unsafePage.evaluate(() => {
    ;(window as typeof window & { __updateReloadGuard?: string }).__updateReloadGuard = 'still-here'
  })

  const updatedTabNavigated = page.waitForEvent('framenavigated', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Update now' }).click()
  await updatedTabNavigated

  await expect(unsafePage.locator('.toast')).toContainText('Update paused because your latest changes are not saved')
  expect(await unsafePage.evaluate(() => (
    window as typeof window & { __updateReloadGuard?: string }
  ).__updateReloadGuard)).toBe('still-here')
  await expect(unsafePage.getByRole('button', { name: 'Update now' })).toBeEnabled()
  await expect.poll(() => unsafePage.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return {
      controller: navigator.serviceWorker.controller?.scriptURL ?? '',
      waiting: registration?.waiting?.scriptURL ?? '',
    }
  })).toEqual({
    controller: 'http://127.0.0.1:4173/sw.js',
    waiting: '',
  })
})

test.describe('coarse touch mobile PWA', () => {
  const pixel7 = devices['Pixel 7']
  test.use({
    userAgent: pixel7.userAgent,
    viewport: pixel7.viewport,
    screen: pixel7.screen,
    deviceScaleFactor: pixel7.deviceScaleFactor,
    isMobile: pixel7.isMobile,
    hasTouch: pixel7.hasTouch,
  })

  test('respects safe areas, touch target sizing, drawer focus, and mobile input sizing', async ({ page, context }) => {
    const session = await context.newCDPSession(page)
    const safeArea = { top: 47, right: 9, bottom: 34, left: 8 }
    await session.send('Emulation.setSafeAreaInsetsOverride', { insets: safeArea })
    await openCleanApp(page)

    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0)
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true)
    expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('viewport-fit=cover')

    const menuButton = page.getByRole('button', { name: 'Open notes' })
    const menuBox = await menuButton.boundingBox()
    expect(menuBox).not.toBeNull()
    expect(menuBox?.x ?? 0).toBeGreaterThanOrEqual(safeArea.left)
    expect(menuBox?.y ?? 0).toBeGreaterThanOrEqual(safeArea.top)
    expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(menuBox?.height ?? 0).toBeGreaterThanOrEqual(44)

    await menuButton.tap()
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Close notes')

    const newNoteBox = await page.getByRole('button', { name: 'New note' }).boundingBox()
    expect(newNoteBox?.height ?? 0).toBeGreaterThanOrEqual(44)
    await expect(page.getByPlaceholder('Search notes')).toHaveCSS('font-size', '16px')

    const sidebarFooter = await page.locator('.sidebar-footer').boundingBox()
    const viewportHeight = page.viewportSize()?.height ?? 0
    expect((sidebarFooter?.y ?? 0) + (sidebarFooter?.height ?? 0)).toBeLessThanOrEqual(viewportHeight - safeArea.bottom)

    await page.getByRole('button', { name: 'Close notes' }).tap()
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Open notes')

    await page.keyboard.press('Control+K')
    await expect(page.getByPlaceholder('Search notes')).toBeFocused()
    await page.getByRole('button', { name: 'Close notes' }).tap()

    await menuButton.tap()
    await page.getByRole('button', { name: 'New note' }).tap()
    await expect(page.getByRole('textbox', { name: 'Note title' })).toBeFocused()

    const firstBlock = page.getByRole('textbox', { name: 'Text block' }).first()
    await firstBlock.fill('/todo')
    await firstBlock.press('Enter')
    const checklist = page.getByRole('textbox', { name: 'To-do list block' })
    const checkButton = page.getByRole('button', { name: 'Mark complete' })
    const [checkBox, checklistBox, checklistPadding] = await Promise.all([
      checkButton.boundingBox(),
      checklist.boundingBox(),
      checklist.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingLeft)),
    ])
    expect(checkBox?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect((checkBox?.x ?? 0) + (checkBox?.width ?? 0)).toBeLessThanOrEqual(
      (checklistBox?.x ?? 0) + checklistPadding,
    )

    await menuButton.tap()
    await page.getByRole('button', { name: 'Archive', exact: true }).tap()
    const toast = page.locator('.toast')
    await expect(toast).toContainText('Archive is empty.')
    const toastBox = await toast.boundingBox()
    expect((toastBox?.y ?? 0) + (toastBox?.height ?? 0)).toBeLessThanOrEqual(viewportHeight - safeArea.bottom)
    expect((await page.getByRole('button', { name: 'Add icon' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.setViewportSize({ width: 320, height: 700 })
    await expect(page.getByRole('button', { name: 'Open notes' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.getByRole('button', { name: 'Add cover' }).tap()
    await page.setViewportSize({ width: 915, height: 412 })
    await session.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 0, right: 47, bottom: 8, left: 34 },
    })
    await expect(page.getByRole('textbox', { name: 'Note title' })).toBeVisible()
    const removeCoverBox = await page.getByRole('button', { name: 'Remove cover' }).boundingBox()
    expect((removeCoverBox?.x ?? 0) + (removeCoverBox?.width ?? 0)).toBeLessThanOrEqual(915 - 47)
    expect(await page.evaluate(() => ({
      fitsWidth: document.documentElement.scrollWidth <= window.innerWidth,
      shellHeight: document.querySelector('.app-shell')?.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
      documentPaddingLeft: getComputedStyle(document.querySelector('.document-column') as HTMLElement).paddingLeft,
    }))).toEqual({ fitsWidth: true, shellHeight: 412, viewportHeight: 412, documentPaddingLeft: '62px' })

    await page.getByRole('tab', { name: 'Draw' }).tap()
    const toolbarLayout = await page.locator('.drawing-toolbar').evaluate((toolbar) => {
      const properties = toolbar.querySelector<HTMLElement>('.drawing-properties')
      const history = toolbar.querySelector<HTMLElement>('.history-tools')
      const propertiesRect = properties?.getBoundingClientRect()
      const historyRect = history?.getBoundingClientRect()
      return {
        outerFits: toolbar.scrollWidth <= toolbar.clientWidth,
        propertiesOverflow: properties ? getComputedStyle(properties).overflowX : '',
        propertiesScrollWidth: properties?.scrollWidth ?? 0,
        propertiesClientWidth: properties?.clientWidth ?? 0,
        groupsSeparated: Boolean(propertiesRect && historyRect && historyRect.top >= propertiesRect.bottom),
      }
    })
    expect(toolbarLayout.outerFits).toBe(true)
    expect(toolbarLayout.propertiesOverflow).toBe('auto')
    expect(toolbarLayout.propertiesScrollWidth).toBeGreaterThan(toolbarLayout.propertiesClientWidth)
    expect(toolbarLayout.groupsSeparated).toBe(true)
    const swatchSizes = await page.locator('.color-picker button').evaluateAll((buttons) => (
      buttons.map((button) => {
        const box = button.getBoundingClientRect()
        return { width: box.width, height: box.height }
      })
    ))
    expect(swatchSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true)
  })

  test('draws with touch while an extra finger cannot replace the active stroke', async ({ page, context }) => {
    await openCleanApp(page)
    await page.getByRole('tab', { name: 'Draw' }).tap()
    const penTool = page.getByRole('button', { name: 'Pen (P)' })
    expect((await penTool.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    await penTool.tap()

    const canvas = page.getByRole('application', { name: /Editable drawing canvas/ })
    const bounds = await canvas.boundingBox()
    expect(bounds).not.toBeNull()
    if (!bounds) return

    const scrollTop = await page.locator('.workspace-scroll').evaluate((element) => element.scrollTop)
    const session = await context.newCDPSession(page)
    const primary = (x: number, y: number, force = 0.55) => ({ id: 1, x: bounds.x + x, y: bounds.y + y, force })
    const secondary = (x: number, y: number) => ({ id: 2, x: bounds.x + x, y: bounds.y + y, force: 0.7 })

    await dispatchTouch(session, 'touchStart', [primary(60, 80, 0.3)])
    await dispatchTouch(session, 'touchMove', [primary(100, 100, 0.45)])
    await dispatchTouch(session, 'touchStart', [primary(100, 100, 0.45), secondary(bounds.width - 45, 55)])
    await dispatchTouch(session, 'touchMove', [primary(145, 125, 0.6), secondary(bounds.width - 45, 180)])
    await dispatchTouch(session, 'touchMove', [primary(190, 150, 0.75), secondary(bounds.width - 45, 280)])
    await dispatchTouch(session, 'touchEnd', [])

    await expect(page.getByRole('toolbar', { name: 'Selected object actions' })).toContainText('Pen selected')
    expect(await page.locator('.workspace-scroll').evaluate((element) => element.scrollTop)).toBe(scrollTop)

    await expect.poll(async () => {
      const drawing = await persistedDrawing(page)
      return drawing?.elements.length ?? 0
    }).toBe(1)
    const drawing = await persistedDrawing(page)
    expect(drawing?.elements[0]).toMatchObject({ type: 'pen' })
    expect(drawing?.elements[0].points?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(drawing?.elements[0].x ?? Number.POSITIVE_INFINITY).toBeLessThan(100)
    expect(drawing?.elements[0].width ?? Number.POSITIVE_INFINITY).toBeGreaterThan(100)
    expect(drawing?.elements[0].width ?? Number.POSITIVE_INFINITY).toBeLessThan(170)
    expect(drawing?.elements[0].height ?? Number.POSITIVE_INFINITY).toBeGreaterThan(50)
    expect(drawing?.elements[0].height ?? Number.POSITIVE_INFINITY).toBeLessThan(100)
    const points = drawing?.elements[0].points ?? []
    expect(points[0]).toMatchObject({ x: 0, y: 0 })
    expect(points.at(-1)?.x).toBeCloseTo(1)
    expect(points.at(-1)?.y).toBeCloseTo(1)
    await expect(page.getByRole('button', { name: 'Clear board' })).toBeEnabled()

    const undo = page.getByRole('button', { name: 'Undo' })
    const redo = page.getByRole('button', { name: 'Redo' })
    await undo.click()
    await expect(redo).toBeEnabled()
    await expect.poll(async () => (await persistedDrawing(page))?.elements.length ?? 0).toBe(0)
    await expect(undo).toBeDisabled()
    await redo.click()
    await expect(page.getByRole('button', { name: 'Clear board' })).toBeEnabled()
  })
})
