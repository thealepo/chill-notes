import assert from 'node:assert/strict'
import test from 'node:test'
import { hasInlineMath, parseMathContent } from '../src/lib/mathContent.ts'

test('parses double-dollar expressions as display math', () => {
  assert.deepEqual(parseMathContent(String.raw`$$\frac{x}{2}$$`), [{
    kind: 'math',
    expression: String.raw`\frac{x}{2}`,
    displayMode: true,
  }])
})

test('keeps single-dollar expressions inline with surrounding prose', () => {
  assert.deepEqual(parseMathContent('Area is $a^2$ square units.'), [
    { kind: 'text', content: 'Area is ' },
    { kind: 'math', expression: 'a^2', displayMode: false },
    { kind: 'text', content: ' square units.' },
  ])
})

test('does not classify unmatched delimiters as rendered math', () => {
  assert.equal(hasInlineMath('Price is $12 and rising'), false)
  assert.deepEqual(parseMathContent('Price is $12 and rising'), [
    { kind: 'text', content: 'Price is $12 and rising' },
  ])
})
