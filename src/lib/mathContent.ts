const INLINE_MATH_PATTERN = /(\$\$[^$]+\$\$|\$(?!\s)[^$\n]*?[^\s$]\$(?!\d))/g

export type MathContentPart =
  | { kind: 'text'; content: string }
  | { kind: 'math'; expression: string; displayMode: boolean }

export function parseMathContent(content: string): MathContentPart[] {
  return content
    .split(INLINE_MATH_PATTERN)
    .map((part, index): MathContentPart | null => {
      if (!part) return null
      if (index % 2 === 0) return { kind: 'text', content: part }
      const displayMode = part.startsWith('$$')
      return {
        kind: 'math',
        expression: displayMode ? part.slice(2, -2) : part.slice(1, -1),
        displayMode,
      }
    })
    .filter((part): part is MathContentPart => part !== null)
}

export function hasInlineMath(content: string): boolean {
  return parseMathContent(content).some((part) => part.kind === 'math')
}
