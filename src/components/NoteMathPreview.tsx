import { useMemo } from 'react'
import { parseMathContent } from '../lib/mathContent'
import { renderMathExpression } from '../lib/mathRendering'

export function MathPreview({ expression, displayMode = true }: { expression: string; displayMode?: boolean }) {
  const rendered = useMemo(() => {
    return renderMathExpression(expression, displayMode)
  }, [expression, displayMode])

  if (!rendered) return <span className="math-placeholder">Type a LaTeX expression…</span>
  return <span className="math-rendered-output" dangerouslySetInnerHTML={{ __html: rendered }} />
}

export function InlineMathPreview({ content }: { content: string }) {
  const parts = parseMathContent(content)
  if (!parts.some((part) => part.kind === 'math')) return null
  const hasDisplayMath = parts.some((part) => part.kind === 'math' && part.displayMode)
  return (
    <div
      className={`inline-math-preview ${hasDisplayMath ? 'has-display-math' : ''}`}
      aria-label="Rendered equation preview"
    >
      {parts.map((part, index) => {
        if (part.kind === 'math') {
          return (
            <MathPreview
              key={index}
              expression={part.expression}
              displayMode={part.displayMode}
            />
          )
        }
        return <span key={index}>{part.content}</span>
      })}
    </div>
  )
}
