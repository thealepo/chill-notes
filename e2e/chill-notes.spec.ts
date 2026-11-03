import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

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

async function writeIndexedWorkspaceRecord(page: Page, value: unknown) {
  await page.evaluate(async (storedValue) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open('chill-notes', 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('workspace')) {
          request.result.createObjectStore('workspace')
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('workspace', 'readwrite')
      transaction.objectStore('workspace').put(storedValue, 'current')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
  }, value)
}

async function readIndexedWorkspaceRecord(page: Page, key: string): Promise<unknown> {
  return page.evaluate(async (recordKey) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open('chill-notes', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction('workspace', 'readonly').objectStore('workspace').get(recordKey)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()
    return value
  }, key)
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

test('makes LaTeX source secondary to a full-size display equation', async ({ page }) => {
  const source = page.getByRole('textbox', { name: 'Text block' }).first()
  await source.fill(String.raw`$$\frac{x^2 + y^2}{2} = z$$`)

  const block = source.locator('..').locator('..')
  const preview = block.getByLabel('Rendered equation preview')
  await expect(source).toHaveClass(/math-source/)
  await expect(source).toHaveValue(String.raw`$$\frac{x^2 + y^2}{2} = z$$`)
  await expect(preview).toHaveClass(/has-display-math/)
  await expect(preview.locator('.katex-display')).toBeVisible()

  const sourceSize = await source.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  const resultSize = await preview.locator('.katex').evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize),
  )
  expect(resultSize).toBeGreaterThan(sourceSize)
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
  const pngPath = await png.path()
  expect(pngPath).not.toBeNull()
  if (pngPath) {
    const pngBytes = await readFile(pngPath)
    expect(pngBytes.readUInt32BE(16)).toBe(2656)
    expect(pngBytes.readUInt32BE(20)).toBe(1696)
  }
  await expect(page.locator('.drawing-tip')).toContainText('Drawing exported as PNG')
})

test('round-trips a JSON backup with drawings, favorites, and archived notes', async ({ page }) => {
  const drawing = JSON.stringify({
    type: 'chill-drawing',
    version: 1,
    paper: 'lined',
    elements: [{
      id: 'portable-shape',
      type: 'ellipse',
      x: 20,
      y: 30,
      width: 160,
      height: 80,
      strokeColor: '#493d40',
      strokeWidth: 3,
      opacity: 1,
    }],
  })
  await writeIndexedWorkspaceRecord(page, JSON.stringify({
    type: 'chill-notes-workspace',
    version: 1,
    notes: [
      {
        id: 'portable-note',
        title: 'Portable drawing',
        updatedAt: 200,
        favorite: true,
        pageIcon: '🌸',
        hasCover: true,
        drawing,
        blocks: [{ id: 'portable-block', kind: 'text', content: 'Travels with the backup' }],
      },
      {
        id: 'archived-note',
        title: 'Archived reference',
        updatedAt: 100,
        favorite: false,
        archived: true,
        blocks: [{ id: 'archived-block', kind: 'checklist', content: 'Still available', checked: true }],
      },
    ],
    tombstones: {},
  }))
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Portable drawing')

  await page.getByRole('button', { name: 'Workspace options' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Download backup' }).click()
  const backupDownload = await downloadPromise
  expect(await backupDownload.failure()).toBeNull()
  const backupPath = await backupDownload.path()
  expect(backupPath).not.toBeNull()
  if (!backupPath) return

  const exportedNotes = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(exportedNotes).toHaveLength(2)
  expect(exportedNotes).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: 'portable-note',
      title: 'Portable drawing',
      favorite: true,
      pageIcon: '🌸',
      hasCover: true,
      drawing,
    }),
    expect.objectContaining({
      id: 'archived-note',
      title: 'Archived reference',
      archived: true,
    }),
  ]))

  await page.getByLabel('Choose a JSON file to import notes').setInputFiles(backupPath)
  await expect(page.locator('.toast')).toHaveText('Imported 2 notes.')
  await expect.poll(async () => {
    const record = await readIndexedWorkspaceRecord(page, 'current')
    return typeof record === 'string' ? JSON.parse(record).notes.length : 0
  }).toBe(4)

  const roundTrippedRecord = await readIndexedWorkspaceRecord(page, 'current')
  expect(typeof roundTrippedRecord).toBe('string')
  const roundTrippedNotes = JSON.parse(roundTrippedRecord as string).notes
  const drawingCopies = roundTrippedNotes.filter((note: { title: string }) => note.title === 'Portable drawing')
  const archivedCopies = roundTrippedNotes.filter((note: { title: string }) => note.title === 'Archived reference')
  expect(drawingCopies).toHaveLength(2)
  expect(archivedCopies).toHaveLength(2)
  expect(new Set(drawingCopies.map((note: { id: string }) => note.id)).size).toBe(2)
  expect(drawingCopies.every((note: {
    favorite: boolean
    pageIcon?: string
    hasCover?: boolean
    drawing?: string
  }) => (
    note.favorite === true
    && note.pageIcon === '🌸'
    && note.hasCover === true
    && note.drawing === drawing
  ))).toBe(true)
  expect(archivedCopies.every((note: { archived?: boolean }) => note.archived === true)).toBe(true)
})

test('imports valid notes from a partially malformed backup and reports skipped entries', async ({ page }) => {
  const partialBackup = JSON.stringify([
    {
      title: 'Recovered partial note',
      blocks: [
        { kind: 'text', content: 'Valid content' },
        { kind: 'unknown', content: 'Invalid block' },
      ],
    },
    { title: 'No usable blocks', blocks: [{ kind: 'unknown', content: 'Invalid' }] },
    { title: false, blocks: [{ kind: 'text', content: 'Invalid title' }] },
  ])

  await page.getByLabel('Choose a JSON file to import notes').setInputFiles({
    name: 'partial-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(partialBackup),
  })

  await expect(page.locator('.toast')).toHaveText('Imported 1 note. Skipped 2.')
  await expect.poll(async () => {
    const record = await readIndexedWorkspaceRecord(page, 'current')
    if (typeof record !== 'string') return null
    const imported = JSON.parse(record).notes.find((note: { title: string }) => note.title === 'Recovered partial note')
    return imported?.blocks.map((block: { kind: string; content: string }) => ({
      kind: block.kind,
      content: block.content,
    })) ?? null
  }).toEqual([{ kind: 'text', content: 'Valid content' }])
})

test('omits an unavailable legacy image without blocking PNG export', async ({ page }) => {
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
        id: 'legacy-drawing-note',
        title: 'Legacy drawing',
        updatedAt: Date.now(),
        favorite: false,
        drawing: 'data:image/png;base64,broken-image',
        blocks: [{ id: 'legacy-drawing-block', kind: 'text', content: '' }],
      }],
      tombstones: {},
    }))
  })
  await page.reload()
  await openDrawing(page)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const png = await downloadPromise

  expect(await png.failure()).toBeNull()
  await expect(page.locator('.drawing-tip')).toContainText('Exported without 1 unavailable legacy background image.')
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

test('protects corrupt IndexedDB data until the user explicitly replaces it', async ({ page }) => {
  await expect(page.locator('.save-state')).toContainText('Saved')
  const corruptRecord = '{"type":"chill-notes-workspace","version":1'
  await writeIndexedWorkspaceRecord(page, corruptRecord)
  await page.reload()

  const recoveryAlert = page.getByRole('alert')
  await expect(recoveryAlert).toContainText('Saved workspace needs recovery')
  await expect(recoveryAlert).toContainText('Saving is paused')
  await expect(page.locator('.save-state')).toContainText('Saving paused')

  await page.getByRole('textbox', { name: 'Note title' }).fill('Recovered in this tab')
  await expect.poll(() => readIndexedWorkspaceRecord(page, 'current')).toBe(corruptRecord)
  await expect.poll(() => readIndexedWorkspaceRecord(page, 'unreadable-backup')).toBe(corruptRecord)

  const downloadPromise = page.waitForEvent('download')
  await recoveryAlert.getByRole('button', { name: 'Download original data' }).click()
  const recoveryDownload = await downloadPromise
  expect(recoveryDownload.suggestedFilename()).toMatch(
    /^chill-notes-indexeddb-recovery-\d{4}-\d{2}-\d{2}\.json$/,
  )
  const recoveryPath = await recoveryDownload.path()
  expect(recoveryPath).not.toBeNull()
  if (recoveryPath) expect(await readFile(recoveryPath, 'utf8')).toBe(corruptRecord)

  page.once('dialog', (dialog) => dialog.accept())
  await recoveryAlert.getByRole('button', { name: 'Replace saved data' }).click()
  await expect(recoveryAlert).toBeHidden()
  await expect(page.locator('.save-state')).toContainText('Saved')
  await expect.poll(async () => {
    const stored = await readIndexedWorkspaceRecord(page, 'current')
    if (typeof stored !== 'string') return null
    return JSON.parse(stored).notes[0]?.title
  }).toBe('Recovered in this tab')
  expect(await readIndexedWorkspaceRecord(page, 'unreadable-backup')).toBe(corruptRecord)
})

test('keeps unsupported future-version IndexedDB data read-only and recoverable', async ({ page }) => {
  await expect(page.locator('.save-state')).toContainText('Saved')
  const futureRecord = JSON.stringify({
    type: 'chill-notes-workspace',
    version: 99,
    notes: [{
      id: 'future-note',
      title: 'Future workspace',
      updatedAt: Date.now(),
      favorite: false,
      blocks: [{ id: 'future-block', kind: 'text', content: 'Do not normalize me' }],
    }],
    tombstones: {},
    futureField: { preserved: true },
  })
  await writeIndexedWorkspaceRecord(page, futureRecord)
  await page.reload()

  const recoveryAlert = page.getByRole('alert')
  await expect(recoveryAlert).toContainText('This saved workspace needs a newer version')
  await expect(recoveryAlert).toContainText('version 99')
  await expect(page.locator('.save-state')).toContainText('Saving paused')
  await expect.poll(() => readIndexedWorkspaceRecord(page, 'current')).toBe(futureRecord)
  await expect.poll(() => readIndexedWorkspaceRecord(page, 'unreadable-backup')).toBe(futureRecord)
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

test('requests persistent storage only after a user action and shows the granted state', async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as typeof window & { __storagePersistCalls: number }
    testWindow.__storagePersistCalls = 0
    let persistent = false
    Object.defineProperty(navigator.storage, 'persisted', {
      configurable: true,
      value: async () => persistent,
    })
    Object.defineProperty(navigator.storage, 'persist', {
      configurable: true,
      value: async () => {
        testWindow.__storagePersistCalls += 1
        persistent = true
        return true
      },
    })
  })
  await page.reload()

  await page.getByRole('button', { name: 'Workspace options' }).click()
  await expect(page.getByText('Storage may be cleared if space is needed')).toBeVisible()
  expect(await page.evaluate(() => (
    window as typeof window & { __storagePersistCalls: number }
  ).__storagePersistCalls)).toBe(0)

  await page.getByRole('menuitem', { name: 'Protect local data' }).click()
  await expect(page.locator('.toast')).toContainText('Persistent storage enabled')
  expect(await page.evaluate(() => (
    window as typeof window & { __storagePersistCalls: number }
  ).__storagePersistCalls)).toBe(1)

  await page.getByRole('button', { name: 'Workspace options' }).click()
  await expect(page.locator('.workspace-menu').getByText('Persistent storage enabled', { exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Protect local data' })).toHaveCount(0)
})

test('recovers an edit when the page closes immediately after the lifecycle handoff', async ({ page, context }) => {
  await expect(page.locator('.save-state')).toContainText('Saved')
  const stagedTitle = await page.evaluate(() => {
    const title = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note title"]')
    if (!title) throw new Error('Note title was not found.')
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    if (!valueSetter) throw new Error('Textarea value setter was not found.')
    valueSetter.call(title, 'Survives an immediate close')
    title.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: 'Survives an immediate close',
      inputType: 'insertText',
    }))
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }))

    const staged = window.localStorage.getItem('chill-notes-v1')
    return staged ? JSON.parse(staged).notes[0]?.title : null
  })
  expect(stagedTitle).toBe('Survives an immediate close')

  await page.close({ runBeforeUnload: false })
  const reopenedPage = await context.newPage()
  await reopenedPage.goto('/')
  await expect(reopenedPage.getByRole('textbox', { name: 'Note title' })).toHaveValue(
    'Survives an immediate close',
  )
  await expect(reopenedPage.locator('.save-state')).toContainText('Saved')
  await expect.poll(() => reopenedPage.evaluate(() => (
    window.localStorage.getItem('chill-notes-v1')
  ))).toBeNull()
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
