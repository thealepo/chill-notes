import { useMemo } from 'react'
import { renderMathExpression } from '../lib/mathRendering'

const INLINE_MATH_PATTERN = /(\$\$[^$]+\$\$|\$(?!\s)[^$\n]*?[^\s$]\$(?!\d))/g

export function MathPreview({ expression, displayMode = true }: { expression: string; displayMode?: boolean }) {
  const rendered = useMemo(() => {
    return renderMathExpression(expression, displayMode)
  }, [expression, displayMode])

  if (!rendered) return <span className="math-placeholder">Type a LaTeX expression…</span>
  return <span dangerouslySetInnerHTML={{ __html: rendered }} />
}

export function InlineMathPreview({ content }: { content: string }) {
  const parts = content.split(INLINE_MATH_PATTERN)
  if (parts.length === 1) return null
  return (
    <div className="inline-math-preview" aria-label="Rendered inline equation preview">
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          const expression = part.startsWith('$$') ? part.slice(2, -2) : part.slice(1, -1)
          return <MathPreview key={index} expression={expression} displayMode={false} />
        }
        return part ? <span key={index}>{part}</span> : null
      })}
    </div>
  )
}
