import { useEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import {
  CheckSquare,
  ChevronRight,
  GripVertical,
  Heading2,
  ListPlus,
  Plus,
  Quote,
  Sigma,
  Text,
} from 'lucide-react'
import type { BlockKind, Note, NoteBlock } from '../types'

interface NoteEditorProps {
  note: Note
  onChange: (note: Note) => void
}

const commands: { kind: BlockKind; label: string; description: string; icon: typeof Text }[] = [
  { kind: 'text', label: 'Text', description: 'A simple paragraph', icon: Text },
  { kind: 'heading', label: 'Heading', description: 'A section heading', icon: Heading2 },
  { kind: 'checklist', label: 'To-do', description: 'Track a small task', icon: CheckSquare },
  { kind: 'quote', label: 'Quote', description: 'Capture a thought', icon: Quote },
  { kind: 'math', label: 'Equation', description: 'A LaTeX math block', icon: Sigma },
]

function MathPreview({ expression, displayMode = true }: { expression: string; displayMode?: boolean }) {
  const rendered = useMemo(() => {
    if (!expression.trim()) return ''
    try {
      return katex.renderToString(expression, { displayMode, throwOnError: false, strict: false })
    } catch {
      return ''
    }
  }, [expression, displayMode])

  if (!rendered) return <span className="math-placeholder">Your equation will appear here</span>
  return <span dangerouslySetInnerHTML={{ __html: rendered }} />
}

function InlineMathPreview({ content }: { content: string }) {
  const parts = content.split(/(\$[^$]+\$)/g)
  if (parts.length === 1) return null
  return (
    <div className="inline-math-preview" aria-label="Rendered math preview">
      {parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          return <MathPreview key={`${part}-${index}`} expression={part.slice(1, -1)} displayMode={false} />
        }
        return <span key={`${part}-${index}`}>{part}</span>
      })}
    </div>
  )
}

export function NoteEditor({ note, onChange }: NoteEditorProps) {
  const [focusedBlock, setFocusedBlock] = useState<string | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  const words = note.blocks.reduce((total, block) => {
    const count = block.content.trim() ? block.content.trim().split(/\s+/).length : 0
    return total + count
  }, 0)

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'm') {
        event.preventDefault()
        addBlock('math')
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  })

  function commit(blocks: NoteBlock[]) {
    onChange({ ...note, blocks, updatedAt: Date.now() })
  }

  function updateBlock(id: string, patch: Partial<NoteBlock>) {
    commit(note.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)))
  }

  function addBlock(kind: BlockKind = 'text', afterId?: string) {
    const newBlock: NoteBlock = { id: crypto.randomUUID(), kind, content: '', checked: false }
    const afterIndex = afterId ? note.blocks.findIndex((block) => block.id === afterId) : note.blocks.length - 1
    const blocks = [...note.blocks]
    blocks.splice(afterIndex + 1, 0, newBlock)
    commit(blocks)
    requestAnimationFrame(() => blockRefs.current[newBlock.id]?.focus())
  }

  function removeBlock(id: string) {
    if (note.blocks.length === 1) return
    const index = note.blocks.findIndex((block) => block.id === id)
    const nextBlocks = note.blocks.filter((block) => block.id !== id)
    commit(nextBlocks)
    requestAnimationFrame(() => blockRefs.current[nextBlocks[Math.max(0, index - 1)]?.id]?.focus())
  }

  function applyCommand(id: string, kind: BlockKind) {
    updateBlock(id, { kind, content: '' })
    setSlashIndex(0)
    requestAnimationFrame(() => blockRefs.current[id]?.focus())
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>, block: NoteBlock) {
    const showSlash = focusedBlock === block.id && block.content.startsWith('/')
    if (showSlash && event.key === 'ArrowDown') {
      event.preventDefault()
      setSlashIndex((current) => (current + 1) % commands.length)
      return
    }
    if (showSlash && event.key === 'ArrowUp') {
      event.preventDefault()
      setSlashIndex((current) => (current - 1 + commands.length) % commands.length)
      return
    }
    if (showSlash && event.key === 'Enter') {
      event.preventDefault()
      applyCommand(block.id, commands[slashIndex].kind)
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      addBlock('text', block.id)
    }
    if (event.key === 'Backspace' && block.content === '') {
      event.preventDefault()
      removeBlock(block.id)
    }
  }

  return (
    <section className="type-editor" aria-label="Typed note editor">
      <div className="block-toolbar" aria-label="Add a block">
        {commands.map(({ kind, label, icon: Icon }) => (
          <button key={kind} onClick={() => addBlock(kind)} title={`Add ${label.toLowerCase()}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      <div className="blocks">
        {note.blocks.map((block) => {
          const showSlash = focusedBlock === block.id && block.content.startsWith('/')
          return (
            <div className={`editor-block kind-${block.kind}`} key={block.id}>
              <button className="block-handle" aria-label="Block options"><GripVertical size={16} /></button>
              <button className="block-add" onClick={() => addBlock('text', block.id)} aria-label="Add block"><Plus size={15} /></button>
              {block.kind === 'checklist' && (
                <button
                  className={`check-button ${block.checked ? 'checked' : ''}`}
                  onClick={() => updateBlock(block.id, { checked: !block.checked })}
                  aria-label={block.checked ? 'Mark incomplete' : 'Mark complete'}
                >
                  {block.checked && '✓'}
                </button>
              )}
              {block.kind === 'quote' && <span className="quote-mark">“</span>}
              {block.kind === 'math' && <span className="math-sigil">ƒ</span>}
              <div className="block-content">
                <textarea
                  ref={(element) => { blockRefs.current[block.id] = element }}
                  rows={1}
                  value={block.content}
                  onChange={(event) => {
                    updateBlock(block.id, { content: event.target.value })
                    event.target.style.height = 'auto'
                    event.target.style.height = `${event.target.scrollHeight}px`
                  }}
                  onFocus={() => setFocusedBlock(block.id)}
                  onBlur={() => window.setTimeout(() => setFocusedBlock(null), 120)}
                  onKeyDown={(event) => handleKeyDown(event, block)}
                  placeholder={
                    block.kind === 'math'
                      ? 'Type LaTeX, like \\frac{a}{b}'
                      : block.kind === 'heading'
                        ? 'Heading'
                        : block.kind === 'quote'
                          ? 'A thought worth keeping…'
                          : 'Type “/” for commands…'
                  }
                  aria-label={`${block.kind} block`}
                  className={block.checked ? 'completed' : ''}
                />
                {block.kind === 'math' && (
                  <div className="math-preview"><MathPreview expression={block.content} /></div>
                )}
                {block.kind !== 'math' && <InlineMathPreview content={block.content} />}
                {showSlash && (
                  <div className="slash-menu">
                    <div className="slash-title">Turn into</div>
                    {commands.map(({ kind, label, description, icon: Icon }, index) => (
                      <button
                        key={kind}
                        className={index === slashIndex ? 'selected' : ''}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applyCommand(block.id, kind)}
                      >
                        <span className="command-icon"><Icon size={17} /></span>
                        <span><strong>{label}</strong><small>{description}</small></span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button className="add-block-row" onClick={() => addBlock()}>
        <ListPlus size={16} /> Add a new block
      </button>

      <footer className="editor-footer">
        <span>{words} {words === 1 ? 'word' : 'words'}</span>
        <span className="latex-tip"><Sigma size={13} /> Use <code>$…$</code> for inline math · <kbd>⌘ M</kbd> for an equation</span>
      </footer>
    </section>
  )
}
