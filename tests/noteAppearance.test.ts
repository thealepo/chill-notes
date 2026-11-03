import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_NOTE_ICON_LENGTH, normalizeNoteIcon } from '../src/lib/noteAppearance.ts'

test('custom note icons trim whitespace and omit unusable values', () => {
  assert.equal(normalizeNoteIcon('  🌸  '), '🌸')
  assert.equal(normalizeNoteIcon(' \n\t '), undefined)
  assert.equal(normalizeNoteIcon(null), undefined)
})

test('custom note icons stay within the picker limit without splitting a code point', () => {
  assert.equal(normalizeNoteIcon('abcdefghijklmnop-extra'), 'abcdefghijklmnop')
  assert.equal(normalizeNoteIcon('abcdefghijklmno🌸extra'), 'abcdefghijklmno')
  assert.equal(normalizeNoteIcon('🌸'.repeat(MAX_NOTE_ICON_LENGTH)), '🌸'.repeat(MAX_NOTE_ICON_LENGTH / 2))
})
