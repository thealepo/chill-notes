import katex from 'katex'

/** Render user-authored math without allowing commands that emit trusted HTML. */
export function renderMathExpression(expression: string, displayMode: boolean): string {
  if (!expression.trim()) return ''
  try {
    return katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    })
  } catch {
    return ''
  }
}
