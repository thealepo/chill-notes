import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDrawingScene } from '../src/lib/drawingScene.ts'
import {
  markdownFilename,
  noteToMarkdown,
  parseImportedNotes,
  serializeNotesExport,
} from '../src/lib/noteSerialization.ts'
import type { Note } from '../src/types.ts'

test('JSON backup round-trips drawings and presentation metadata with fresh IDs', () => {
  const drawing = JSON.stringify({
    type: 'chill-drawing',
    version: 1,
    paper: 'grid',
    elements: [{
      id: 'shape-1',
      type: 'rectangle',
      x: 12,
      y: 24,
      width: 180,
      height: 90,
      strokeColor: '#493d40',
      strokeWidth: 3,
      opacity: 1,
    }],
  })
  const original: Note = {
    id: 'portable-note',
    title: 'Portable workspace',
    updatedAt: 1_700_000_000_000,
    favorite: true,
    archived: true,
    pageIcon: '🌸',
    pageCover: 'lavender',
    drawing,
    blocks: [
      { id: 'heading', kind: 'heading2', content: 'Preserved content' },
      { id: 'task', kind: 'checklist', content: 'Pack the drawing', checked: true },
    ],
  }

  const backup = serializeNotesExport([original])
  assert.deepEqual(JSON.parse(backup), [original])

  const result = parseImportedNotes(backup)
  assert.equal(result.skipped, 0)
  assert.equal(result.notes.length, 1)
  const [restored] = result.notes
  assert.notEqual(restored.id, original.id)
  assert.equal(restored.blocks.length, original.blocks.length)
  assert.notEqual(restored.blocks[0].id, original.blocks[0].id)
  assert.deepEqual({
    ...restored,
    id: original.id,
    blocks: restored.blocks.map((block, index) => ({
      ...block,
      id: original.blocks[index].id,
    })),
  }, original)
  assert.equal(parseDrawingScene(restored.drawing).elements[0]?.type, 'rectangle')
})

test('legacy boolean covers import as the original rose cover', () => {
  const result = parseImportedNotes(JSON.stringify([{
    title: 'Legacy presentation',
    pageIcon: '🌿',
    hasCover: true,
    blocks: [{ kind: 'text', content: 'Still portable' }],
  }]))

  assert.equal(result.skipped, 0)
  assert.equal(result.notes[0].pageIcon, '🌿')
  assert.equal(result.notes[0].pageCover, 'rose')
  assert.equal('hasCover' in result.notes[0], false)
})

test('partial imports retain valid content while reporting malformed notes', () => {
  const result = parseImportedNotes(JSON.stringify([
    {
      title: 'Partially valid',
      favorite: true,
      blocks: [
        { kind: 'text', content: 'Keep me' },
        { kind: 'unknown', content: 'Drop this block' },
        { kind: 'checklist', content: 'Invalid checked state', checked: 'yes' },
        null,
      ],
    },
    { title: 'No usable blocks', blocks: [{ kind: 'unknown', content: 'Nope' }] },
    { title: 42, blocks: [{ kind: 'text', content: 'Invalid title' }] },
    { title: 'Unknown cover', pageCover: 'glitch', blocks: [{ kind: 'text', content: 'Invalid cover' }] },
    'not a note',
  ]))

  assert.equal(result.skipped, 4)
  assert.equal(result.notes.length, 1)
  assert.equal(result.notes[0].title, 'Partially valid')
  assert.equal(result.notes[0].favorite, true)
  assert.deepEqual(
    result.notes[0].blocks.map(({ kind, content }) => ({ kind, content })),
    [{ kind: 'text', content: 'Keep me' }],
  )
})

test('imports reject invalid JSON and non-array backup roots', () => {
  assert.throws(
    () => parseImportedNotes('{"title":'),
    /does not contain valid JSON/,
  )
  assert.throws(
    () => parseImportedNotes(JSON.stringify({ notes: [] })),
    /must contain a JSON array of notes/,
  )
})

test('Markdown export handles list flow, multiline quotes, nested fences, equations, and drawings', () => {
  const note: Note = {
    id: 'markdown-edges',
    title: '   ',
    updatedAt: 1,
    favorite: false,
    drawing: '{"type":"chill-drawing","version":1,"paper":"dot","elements":[]}',
    blocks: [
      { id: 'heading', kind: 'heading2', content: 'Portable details' },
      { id: 'first', kind: 'numbered', content: 'First' },
      { id: 'second', kind: 'numbered', content: 'Second' },
      { id: 'bullet', kind: 'bullet', content: 'Related item' },
      { id: 'checked', kind: 'checklist', content: 'Verified', checked: true },
      { id: 'quote', kind: 'quote', content: 'First line\n\nLast line' },
      { id: 'code', kind: 'code', content: 'const fence = ```inside```' },
      { id: 'math', kind: 'math', content: String.raw`\int_0^1 x^2 \, dx` },
      { id: 'empty', kind: 'text', content: '' },
    ],
  }

  assert.equal(noteToMarkdown(note), [
    '## Portable details',
    '',
    '1. First',
    '2. Second',
    '- Related item',
    '- [x] Verified',
    '',
    '> First line',
    '>',
    '> Last line',
    '',
    '````',
    'const fence = ```inside```',
    '````',
    '',
    '$$',
    String.raw`\int_0^1 x^2 \, dx`,
    '$$',
    '',
    '<!-- This note has a drawing that is not included in the Markdown export. -->',
    '',
  ].join('\n'))
})

test('Markdown filenames normalize unsafe and empty titles', () => {
  assert.equal(markdownFilename('  Project: launch / review?  '), 'Project-launch-review.md')
  assert.equal(markdownFilename(' . / \\ * '), 'untitled-note.md')
})
