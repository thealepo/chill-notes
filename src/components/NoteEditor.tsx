import { useEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import {
  Braces,
  CheckSquare,
  ChevronRight,
  Code2,
  Copy,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  Sigma,
  Trash2,
  Type,
} from 'lucide-react'
import type { BlockKind, Note, NoteBlock } from '../types'

interface NoteEditorProps {
  note: Note
  onChange: (note: Note) => void
}

interface BlockCommand {
  kind: BlockKind
  label: string
  description: string
  aliases: string[]
  group: 'Basic blocks' | 'Advanced'
  icon: typeof Type
}

const commands: BlockCommand[] = [
  { kind: 'text', label: 'Text', description: 'Plain text block', aliases: ['plain', 'paragraph'], group: 'Basic blocks', icon: Type },
  { kind: 'heading1', label: 'Heading 1', description: 'Large section heading', aliases: ['h1', '#'], group: 'Basic blocks', icon: Heading1 },
  { kind: 'heading2', label: 'Heading 2', description: 'Medium section heading', aliases: ['h2', '##'], group: 'Basic blocks', icon: Heading2 },
  { kind: 'heading3', label: 'Heading 3', description: 'Small section heading', aliases: ['h3', '###'], group: 'Basic blocks', icon: Heading3 },
  { kind: 'bullet', label: 'Bulleted list', description: 'Create a simple list', aliases: ['bullet', 'ul', '-'], group: 'Basic blocks', icon: List },
  { kind: 'numbered', label: 'Numbered list', description: 'Create an ordered list', aliases: ['number', 'ol', '1.'], group: 'Basic blocks', icon: ListOrdered },
  { kind: 'checklist', label: 'To-do list', description: 'Track a task with a checkbox', aliases: ['todo', 'checkbox', '[]'], group: 'Basic blocks', icon: CheckSquare },
  { kind: 'quote', label: 'Quote', description: 'Capture a quotation', aliases: ['quote', 'citation'], group: 'Basic blocks', icon: Quote },
  { kind: 'divider', label: 'Divider', description: 'Visually divide the page', aliases: ['divider', 'line', '---'], group: 'Basic blocks', icon: Minus },
  { kind: 'code', label: 'Code', description: 'Write a code snippet', aliases: ['code', 'snippet'], group: 'Advanced', icon: Code2 },
  { kind: 'math', label: 'Block equation', description: 'Display a LaTeX equation', aliases: ['math', 'latex', 'equation'], group: 'Advanced', icon: Sigma },
]

const listKinds: BlockKind[] = ['bullet', 'numbered', 'checklist']
const structuralKinds: BlockKind[] = ['heading1', 'heading2', 'heading3', 'bullet', 'numbered', 'checklist', 'quote', 'code']

function MathPreview({ expression, displayMode = true }: { expression: string; displayMode?: boolean }) {
  const rendered = useMemo(() => {
    if (!expression.trim()) return ''
    try {
      return katex.renderToString(expression, { displayMode, throwOnError: false, strict: false })
    } catch {
      return ''
    }
  }, [expression, displayMode])

  if (!rendered) return <span className="math-placeholder">Type a LaTeX expression…</span>
  return <span dangerouslySetInnerHTML={{ __html: rendered }} />
}

function InlineMathPreview({ content }: { content: string }) {
  const parts = content.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g)
  if (parts.length === 1) return null
  return (
    <div className="inline-math-preview" aria-label="Rendered inline equation preview">
      {parts.map((part, index) => {
        const isDouble = part.startsWith('$$') && part.endsWith('$$')
        const isSingle = !isDouble && part.startsWith('$') && part.endsWith('$')
        if (isDouble || isSingle) {
          const expression = isDouble ? part.slice(2, -2) : part.slice(1, -1)
          return <MathPreview key={`${part}-${index}`} expression={expression} displayMode={false} />
        }
        return <span key={`${part}-${index}`}>{part}</span>
      })}
    </div>
  )
}

function commandMatches(command: BlockCommand, query: string) {
  const haystack = [command.label, command.description, ...command.aliases].join(' ').toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export function NoteEditor({ note, onChange }: NoteEditorProps) {
  const [focusedBlock, setFocusedBlock] = useState<string | null>(null)
  const [insertMenuBlock, setInsertMenuBlock] = useState<string | null>(null)
  const [actionsBlock, setActionsBlock] = useState<string | null>(null)
  const [menuIndex, setMenuIndex] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  useEffect(() => {
    for (const input of Object.values(blockRefs.current)) {
      if (!input) continue
      input.style.height = 'auto'
      input.style.height = `${input.scrollHeight}px`
    }
  }, [note.id, note.blocks.length])

  function commit(blocks: NoteBlock[]) {
    onChange({ ...note, blocks, updatedAt: Date.now() })
  }

  function updateBlock(id: string, patch: Partial<NoteBlock>) {
    commit(note.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)))
  }

  function addBlock(kind: BlockKind = 'text', afterId?: string, openMenu = false) {
    const newBlock: NoteBlock = { id: crypto.randomUUID(), kind, content: '', checked: false }
    const afterIndex = afterId ? note.blocks.findIndex((block) => block.id === afterId) : note.blocks.length - 1
    const blocks = [...note.blocks]
    blocks.splice(afterIndex + 1, 0, newBlock)
    commit(blocks)
    if (openMenu) setInsertMenuBlock(newBlock.id)
    setActionsBlock(null)
    requestAnimationFrame(() => blockRefs.current[newBlock.id]?.focus())
    return newBlock.id
  }

  function removeBlock(id: string) {
    if (note.blocks.length === 1) {
      updateBlock(id, { kind: 'text', content: '', checked: false })
      return
    }
    const index = note.blocks.findIndex((block) => block.id === id)
    const nextBlocks = note.blocks.filter((block) => block.id !== id)
    commit(nextBlocks)
    setActionsBlock(null)
    requestAnimationFrame(() => blockRefs.current[nextBlocks[Math.max(0, index - 1)]?.id]?.focus())
  }

  function duplicateBlock(id: string) {
    const index = note.blocks.findIndex((block) => block.id === id)
    if (index < 0) return
    const duplicate = { ...note.blocks[index], id: crypto.randomUUID() }
    const blocks = [...note.blocks]
    blocks.splice(index + 1, 0, duplicate)
    commit(blocks)
    setActionsBlock(null)
    requestAnimationFrame(() => blockRefs.current[duplicate.id]?.focus())
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = note.blocks.findIndex((block) => block.id === id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= note.blocks.length) return
    const blocks = [...note.blocks]
    const [block] = blocks.splice(index, 1)
    blocks.splice(nextIndex, 0, block)
    commit(blocks)
    requestAnimationFrame(() => blockRefs.current[id]?.focus())
  }

  function applyCommand(id: string, kind: BlockKind) {
    const block = note.blocks.find((item) => item.id === id)
    const content = block?.content.startsWith('/') ? '' : block?.content ?? ''
    updateBlock(id, { kind, content, checked: kind === 'checklist' ? false : undefined })
    setInsertMenuBlock(null)
    setMenuIndex(0)
    requestAnimationFrame(() => blockRefs.current[id]?.focus())
  }

  function openInsertMenu(afterId: string) {
    setMenuIndex(0)
    addBlock('text', afterId, true)
  }

  function handleMarkdownShortcut(event: React.KeyboardEvent<HTMLTextAreaElement>, block: NoteBlock) {
    if (event.key !== ' ' || block.kind !== 'text') return false
    const shortcuts: Record<string, BlockKind> = {
      '#': 'heading1',
      '##': 'heading2',
      '###': 'heading3',
      '-': 'bullet',
      '*': 'bullet',
      '+': 'bullet',
      '1.': 'numbered',
      '[]': 'checklist',
      '"': 'quote',
    }
    const kind = shortcuts[block.content]
    if (!kind) return false
    event.preventDefault()
    updateBlock(block.id, { kind, content: '', checked: kind === 'checklist' ? false : undefined })
    return true
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>, block: NoteBlock) {
    const slashOpen = focusedBlock === block.id && block.content.startsWith('/')
    const menuOpen = slashOpen || insertMenuBlock === block.id
    const query = slashOpen ? block.content.slice(1) : ''
    const filtered = commands.filter((command) => commandMatches(command, query))

    if (menuOpen && event.key === 'Escape') {
      event.preventDefault()
      setInsertMenuBlock(null)
      return
    }
    if (menuOpen && event.key === 'ArrowDown' && filtered.length) {
      event.preventDefault()
      setMenuIndex((current) => (current + 1) % filtered.length)
      return
    }
    if (menuOpen && event.key === 'ArrowUp' && filtered.length) {
      event.preventDefault()
      setMenuIndex((current) => (current - 1 + filtered.length) % filtered.length)
      return
    }
    if (menuOpen && event.key === 'Enter' && filtered.length) {
      event.preventDefault()
      applyCommand(block.id, filtered[Math.min(menuIndex, filtered.length - 1)].kind)
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      duplicateBlock(block.id)
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'ArrowUp') {
      event.preventDefault()
      moveBlock(block.id, -1)
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'ArrowDown') {
      event.preventDefault()
      moveBlock(block.id, 1)
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key === '/') {
      event.preventDefault()
      setActionsBlock(block.id)
      return
    }
    if (handleMarkdownShortcut(event, block)) return

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (block.kind === 'text' && block.content === '---') {
        updateBlock(block.id, { kind: 'divider', content: '' })
        addBlock('text', block.id)
        return
      }
      if (!block.content && structuralKinds.includes(block.kind)) {
        updateBlock(block.id, { kind: 'text', checked: false })
        return
      }
      const nextKind = listKinds.includes(block.kind) ? block.kind : 'text'
      addBlock(nextKind, block.id)
      return
    }
    if (event.key === 'Backspace' && block.content === '') {
      event.preventDefault()
      if (block.kind !== 'text') updateBlock(block.id, { kind: 'text', checked: false })
      else removeBlock(block.id)
    }
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return
    const blocks = [...note.blocks]
    const fromIndex = blocks.findIndex((block) => block.id === draggingId)
    const toIndex = blocks.findIndex((block) => block.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return
    const [moved] = blocks.splice(fromIndex, 1)
    blocks.splice(toIndex, 0, moved)
    commit(blocks)
    setDraggingId(null)
    setDragOverId(null)
  }

  function numberedPosition(index: number) {
    let position = 1
    for (let current = index - 1; current >= 0; current -= 1) {
      if (note.blocks[current].kind !== 'numbered') break
      position += 1
    }
    return position
  }

  return (
    <section className="type-editor notion-editor" aria-label="Typed note editor">
      <div className="blocks">
        {note.blocks.map((block, blockIndex) => {
          const slashOpen = focusedBlock === block.id && block.content.startsWith('/')
          const menuOpen = slashOpen || insertMenuBlock === block.id
          const query = slashOpen ? block.content.slice(1) : ''
          const filteredCommands = commands.filter((command) => commandMatches(command, query))
          let currentGroup = ''
          return (
            <div
              className={`editor-block kind-${block.kind} ${dragOverId === block.id ? 'drag-over' : ''}`}
              key={block.id}
              onDragOver={(event) => { event.preventDefault(); setDragOverId(block.id) }}
              onDrop={() => handleDrop(block.id)}
            >
              <div className="block-gutter">
                <button className="block-add" onClick={() => openInsertMenu(block.id)} aria-label="Add block below"><Plus size={16} /></button>
                <button
                  className="block-handle"
                  aria-label="Open block actions or drag to move"
                  draggable
                  onDragStart={() => setDraggingId(block.id)}
                  onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
                  onClick={() => setActionsBlock((current) => current === block.id ? null : block.id)}
                >
                  <GripVertical size={17} />
                </button>
              </div>

              {block.kind === 'checklist' && (
                <button className={`check-button ${block.checked ? 'checked' : ''}`} onClick={() => updateBlock(block.id, { checked: !block.checked })} aria-label={block.checked ? 'Mark incomplete' : 'Mark complete'}>
                  {block.checked && '✓'}
                </button>
              )}
              {block.kind === 'bullet' && <span className="list-marker">•</span>}
              {block.kind === 'numbered' && <span className="list-marker numbered-marker">{numberedPosition(blockIndex)}.</span>}
              {block.kind === 'quote' && <span className="quote-mark">“</span>}
              {block.kind === 'math' && <span className="math-sigil"><Braces size={15} /></span>}

              <div className="block-content">
                {block.kind === 'divider' && <hr className="notion-divider" />}
                <textarea
                  ref={(element) => { blockRefs.current[block.id] = element }}
                  rows={1}
                  value={block.content}
                  onChange={(event) => {
                    updateBlock(block.id, { content: event.target.value })
                    setMenuIndex(0)
                    event.target.style.height = 'auto'
                    event.target.style.height = `${event.target.scrollHeight}px`
                  }}
                  onFocus={() => setFocusedBlock(block.id)}
                  onBlur={() => window.setTimeout(() => setFocusedBlock(null), 140)}
                  onKeyDown={(event) => handleKeyDown(event, block)}
                  placeholder={
                    block.kind === 'math'
                      ? 'Type LaTeX…'
                      : block.kind === 'code'
                        ? 'Write some code…'
                        : block.kind.startsWith('heading')
                          ? 'Heading'
                          : focusedBlock === block.id || note.blocks.length === 1
                            ? "Type '/' for commands"
                            : ''
                  }
                  aria-label={`${block.kind} block`}
                  className={`${block.checked ? 'completed' : ''} ${block.kind === 'divider' ? 'divider-input' : ''}`}
                />

                {block.kind === 'math' && <div className="math-preview"><MathPreview expression={block.content} /></div>}
                {!['math', 'divider', 'code'].includes(block.kind) && <InlineMathPreview content={block.content} />}

                {menuOpen && (
                  <div className="slash-menu" role="listbox" aria-label="Insert a block">
                    <div className="slash-search"><Pilcrow size={14} /><span>{query ? `Results for “${query}”` : 'Choose a block'}</span></div>
                    <div className="slash-results">
                      {filteredCommands.map((command, index) => {
                        const Icon = command.icon
                        const showGroup = command.group !== currentGroup
                        currentGroup = command.group
                        return (
                          <div key={command.kind}>
                            {showGroup && <div className="slash-title">{command.group}</div>}
                            <button className={index === menuIndex ? 'selected' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand(block.id, command.kind)} role="option" aria-selected={index === menuIndex}>
                              <span className="command-icon"><Icon size={17} /></span>
                              <span><strong>{command.label}</strong><small>{command.description}</small></span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )
                      })}
                      {filteredCommands.length === 0 && <div className="no-command-results">No blocks found</div>}
                    </div>
                    <div className="slash-footer"><span>↑↓ navigate</span><span>↵ select</span><span>esc close</span></div>
                  </div>
                )}

                {actionsBlock === block.id && (
                  <div className="block-actions-menu">
                    <div className="slash-title">Block actions</div>
                    <button onClick={() => { setInsertMenuBlock(block.id); setActionsBlock(null) }}><Type size={15} />Turn into…</button>
                    <button onClick={() => duplicateBlock(block.id)}><Copy size={15} />Duplicate <kbd>⌘D</kbd></button>
                    <button className="danger" onClick={() => removeBlock(block.id)}><Trash2 size={15} />Delete</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button className="page-tail" onClick={() => addBlock()} aria-label="Add another block">
        <Plus size={14} />
        <span>Click to continue</span>
      </button>
    </section>
  )
}
