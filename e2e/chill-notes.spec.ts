import { expect, test, type Page } from '@playwright/test'

async function openCleanApp(page: Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase('chill-notes')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB cleanup was blocked.'))
    })
  })
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Note title' })).toBeVisible()
}

async function openDrawing(page: Page) {
  await page.getByRole('tab', { name: 'Draw' }).click()
  await expect(page.getByRole('region', { name: 'Drawing editor' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await openCleanApp(page)
})

test('edits blocks with Markdown and slash commands, then persists them', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Note title' }).fill('Browser test plan')

  const firstBlock = page.getByRole('textbox', { name: 'Text block' }).first()
  await firstBlock.fill('A persisted introduction')
  await firstBlock.press('End')
  await firstBlock.press('Enter')

  const headingShortcut = page.getByRole('textbox', { name: 'Text block' }).last()
  await headingShortcut.fill('#')
  await headingShortcut.press(' ')
  const heading = page.getByRole('textbox', { name: 'Heading 1 block' })
  await expect(heading).toBeVisible()
  await heading.fill('Reliable editing')
  await heading.press('End')
  await heading.press('Enter')

  const slashBlock = page.getByRole('textbox', { name: 'Text block' }).last()
  await slashBlock.fill('/todo')
  await expect(page.getByRole('listbox', { name: 'Insert a block' })).toBeVisible()
  await expect(page.getByRole('option', { name: /To-do list/ })).toBeVisible()
  await slashBlock.press('Enter')

  const checklist = page.getByRole('textbox', { name: 'To-do list block' })
  await checklist.fill('Ship browser coverage')
  await page.getByRole('button', { name: 'Mark complete' }).click()

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Browser test plan')
  await expect(page.getByRole('textbox', { name: 'Text block' }).first()).toHaveValue('A persisted introduction')
  await expect(page.getByRole('textbox', { name: 'Heading 1 block' })).toHaveValue('Reliable editing')
  await expect(page.getByRole('textbox', { name: 'To-do list block' })).toHaveValue('Ship browser coverage')
  await expect(page.getByRole('button', { name: 'Mark incomplete' })).toHaveAttribute('aria-pressed', 'true')
})

test('creates a shape with a pointer gesture and supports undo and redo', async ({ page }) => {
  await openDrawing(page)
  await page.getByRole('button', { name: 'Rectangle (R)' }).click()

  const canvas = page.getByRole('application', { name: /Editable drawing canvas/ })
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) return

  await page.mouse.move(bounds.x + 100, bounds.y + 100)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 240, bounds.y + 190, { steps: 6 })
  await page.mouse.up()

  await expect(page.getByRole('toolbar', { name: 'Selected object actions' })).toContainText('Rectangle selected')
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled()
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(page.getByRole('button', { name: 'Clear board' })).toBeEnabled()
})

test('supports keyboard creation, movement, selection, and deletion on the canvas', async ({ page }) => {
  await openDrawing(page)
  const canvas = page.getByRole('application', { name: /Editable drawing canvas/ })
  await canvas.focus()

  await canvas.press('r')
  await canvas.press('Enter')
  await expect(page.getByRole('toolbar', { name: 'Selected object actions' })).toContainText('Rectangle selected')
  const keyboardStatus = page.locator('.canvas-frame [role="status"]')
  await expect(keyboardStatus).toContainText('Rectangle created and selected at the center')

  await canvas.press('Shift+ArrowRight')
  await expect(keyboardStatus).toContainText('Rectangle moved 10 pixels right')
  await canvas.press('Escape')
  await expect(page.getByRole('toolbar', { name: 'Selected object actions' })).toBeHidden()

  await canvas.press('v')
  await canvas.press('Enter')
  await expect(keyboardStatus).toContainText('Rectangle selected')
  await canvas.press('Delete')
  await expect(keyboardStatus).toContainText('Rectangle deleted')
  await expect(page.getByRole('button', { name: 'Clear board' })).toBeDisabled()
})

test('downloads Markdown and PNG exports with safe filenames', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Note title' }).fill('Test / exports')
  await page.getByRole('textbox', { name: 'Text block' }).fill('Download coverage')

  await page.getByRole('button', { name: 'Note options' }).click()
  const markdownPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Export as Markdown' }).click()
  const markdown = await markdownPromise
  expect(markdown.suggestedFilename()).toBe('Test-exports.md')
  expect(await markdown.failure()).toBeNull()

  await openDrawing(page)
  const pngPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const png = await pngPromise
  expect(png.suggestedFilename()).toBe('test-exports.png')
  expect(await png.failure()).toBeNull()
  await expect(page.locator('.drawing-tip')).toContainText('Drawing exported as PNG')
})

test('keeps the mobile workspace usable at the minimum supported width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.reload()

  const menuButton = page.getByRole('button', { name: 'Open notes' })
  await expect(menuButton).toBeVisible()
  const sidebar = page.locator('.sidebar')
  const closedBox = await sidebar.boundingBox()
  expect(closedBox?.x).toBeLessThan(0)

  await menuButton.click()
  await expect(page.getByRole('navigation', { name: 'Notes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close notes' })).toBeVisible()
  await expect.poll(async () => (await sidebar.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0)

  await page.getByRole('button', { name: 'Close notes' }).click()
  await expect.poll(async () => (await sidebar.boundingBox())?.x ?? 0).toBeLessThan(0)
  await expect(page.getByRole('textbox', { name: 'Note title' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('migrates legacy localStorage notes into IndexedDB', async ({ page }) => {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase('chill-notes')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB cleanup was blocked.'))
    })
    window.localStorage.setItem('chill-notes-v1', JSON.stringify({
      type: 'chill-notes-workspace',
      version: 1,
      notes: [{
        id: 'legacy-note',
        title: 'Migrated note',
        updatedAt: Date.now(),
        favorite: false,
        blocks: [{ id: 'legacy-block', kind: 'text', content: 'Stored before IndexedDB' }],
      }],
      tombstones: {},
    }))
  })

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Migrated note')
  await expect(page.getByRole('textbox', { name: 'Text block' })).toHaveValue('Stored before IndexedDB')
  await expect(page.locator('.save-state')).toContainText('Saved')
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('chill-notes-v1'))).toBeNull()

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Migrated note')
})

test('warns about low browser capacity and downloads a recovery backup', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'estimate', {
      configurable: true,
      value: async () => ({ usage: 95 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
    })
  })
  await page.reload()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Browser storage is almost full')
  await expect(alert).toContainText('95 MB of 100 MB used')

  const downloadPromise = page.waitForEvent('download')
  await alert.getByRole('button', { name: 'Download backup' }).click()
  const backup = await downloadPromise
  expect(backup.suggestedFilename()).toMatch(/^chill-notes-\d{4}-\d{2}-\d{2}\.json$/)
  expect(await backup.failure()).toBeNull()
})

test('syncs IndexedDB-backed edits between open tabs', async ({ page, context }) => {
  await page.getByRole('textbox', { name: 'Note title' }).fill('Shared through IndexedDB')
  await expect(page.locator('.save-state')).toContainText('Saved')

  const secondPage = await context.newPage()
  await secondPage.goto('/')
  await expect(secondPage.getByRole('textbox', { name: 'Note title' })).toHaveValue('Shared through IndexedDB')

  await secondPage.getByRole('textbox', { name: 'Text block' }).fill('Edited in the second tab')
  await expect(secondPage.locator('.save-state')).toContainText('Saved')
  await expect(page.getByRole('textbox', { name: 'Text block' })).toHaveValue('Edited in the second tab')
})

test('keeps recovery download available when browser persistence fails', async ({ page }) => {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase('chill-notes')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB cleanup was blocked.'))
    })
  })
  await page.addInitScript(() => {
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
  await page.reload()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Your latest changes are not saved')
  const downloadPromise = page.waitForEvent('download')
  await alert.getByRole('button', { name: 'Download backup' }).click()
  const backup = await downloadPromise
  expect(await backup.failure()).toBeNull()
})
