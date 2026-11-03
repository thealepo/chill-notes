import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMathExpression } from '../src/lib/mathRendering.ts'

test('math rendering produces KaTeX markup for ordinary expressions', () => {
  const rendered = renderMathExpression('x^2 + y^2 = z^2', true)

  assert.match(rendered, /class="katex-display"/)
  assert.match(rendered, /x/)
})

test('math rendering keeps trusted HTML commands disabled', () => {
  const rendered = renderMathExpression(String.raw`\href{javascript:alert(1)}{unsafe}`, false)

  assert.doesNotMatch(rendered, /<a\b/i)
  assert.doesNotMatch(rendered, /href=/i)
})

test('math rendering fails closed for unusable input', () => {
  assert.equal(renderMathExpression('', true), '')
  assert.doesNotThrow(() => renderMathExpression(String.raw`\def\loop{\loop}\loop`, true))
})
