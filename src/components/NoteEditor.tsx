import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Braces,
  GripVertical,
  Plus,
} from 'lucide-react'
import { NoteEditorActionsMenu, NoteEditorCommandMenu } from './NoteEditorMenus'
import { InlineMathPreview, MathPreview } from './NoteMathPreview'
import {
  blockCommands,
  blockLabels,
  commandMatches,
  flowingBlockKinds,
  listBlockKinds,
  placeholderForBlock,
  structuralBlockKinds,
} from './noteEditorConfig'
import type { BlockKind, Note, NoteBlock } from '../types'

interface NoteEditorProps {
  note: Note
  onChange: (note: Note) => void
}

type DropPosition = 'before' | 'after'
type CaretPosition = 'start' | 'end' | number

const BLOCK_DRAG_TYPE = 'application/x-chill-notes-block'
const MAX_SLASH_QUERY = 24

function autosizeBlock(element: HTMLTextAreaElement) {
  element.style.height = '0px'
  element.style.height = `${element.scrollHeight}px`
}

export function NoteEditor({ note, onChange }: NoteEditorProps) {
  const [focusedBlock, setFocusedBlock] = useState<string | null>(null)
  const [insertMenuBlock, setInsertMenuBlock] = useState<string | null>(null)
  const [dismissedSlashBlock, setDismissedSlashBlock] = useState<string | null>(null)
  const [actionsBlock, setActionsBlock] = useState<string | null>(null)
  const [menuIndex, setMenuIndex] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null)
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const editorRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    for (const input of Object.values(blockRefs.current)) {
      if (!input) continue
      autosizeBlock(input)
    }
  }, [note.id, note.blocks])

  // Keep the keyboard-selected slash command visible inside the scrolling list.
  useLayoutEffect(() => {
    editorRef.current
      ?.querySelector<HTMLElement>('.slash-menu button.selected')
      ?.scrollIntoView({ block: 'nearest' })
  }, [menuIndex, focusedBlock, insertMenuBlock])

  // Close the "Turn into" and block-action menus when clicking elsewhere.
  useEffect(() => {
    if (!insertMenuBlock && !actionsBlock) return
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Element | null
      if (target?.closest('.slash-menu, .block-actions-menu, .block-handle')) return
      setInsertMenuBlock(null)
      setActionsBlock(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [insertMenuBlock, actionsBlock])

  function focusBlock(id: string | undefined, caret: CaretPosition = 'end') {
    if (!id) return
    requestAnimationFrame(() => {
      const input = blockRefs.current[id]
      if (!input) return
      input.focus()
      const position = caret === 'start' ? 0 : caret === 'end' ? input.value.length : caret
      input.setSelectionRange(position, position)
    })
  }

  function commit(blocks: NoteBlock[]) {
    onChange({ ...note, blocks, updatedAt: Date.now() })
  }

  function updateBlock(id: string, patch: Partial<NoteBlock>) {
    commit(note.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)))
  }

  /** Inserts a block after `afterId`, optionally patching that block in the same commit. */
  function addBlock(
    kind: BlockKind = 'text',
    afterId?: string,
    options: { content?: string; patchCurrent?: Partial<NoteBlock>; caret?: CaretPosition } = {},
  ) {
    const newBlock: NoteBlock = {
      id: crypto.randomUUID(),
      kind,
      content: options.content ?? '',
      ...(kind === 'checklist' ? { checked: false } : {}),
    }
    const afterIndex = afterId ? note.blocks.findIndex((block) => block.id === afterId) : note.blocks.length - 1
    const blocks = note.blocks.map((block) => (
      block.id === afterId && options.patchCurrent ? { ...block, ...options.patchCurrent } : block
    ))
    blocks.splice(afterIndex + 1, 0, newBlock)
    commit(blocks)
    setActionsBlock(null)
    setInsertMenuBlock(null)
    focusBlock(newBlock.id, options.caret ?? 'end')
    return newBlock.id
  }

  function removeBlock(id: string) {
    setActionsBlock(null)
    if (note.blocks.length === 1) {
      updateBlock(id, { kind: 'text', content: '', checked: false })
      focusBlock(id)
      return
    }
    const index = note.blocks.findIndex((block) => block.id === id)
    const nextBlocks = note.blocks.filter((block) => block.id !== id)
    commit(nextBlocks)
    focusBlock(nextBlocks[Math.max(0, index - 1)]?.id)
  }

  function duplicateBlock(id: string) {
    const index = note.blocks.findIndex((block) => block.id === id)
    if (index < 0) return
    const duplicate = { ...note.blocks[index], id: crypto.randomUUID() }
    const blocks = [...note.blocks]
    blocks.splice(index + 1, 0, duplicate)
    commit(blocks)
    setActionsBlock(null)
    focusBlock(duplicate.id)
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = note.blocks.findIndex((block) => block.id === id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= note.blocks.length) return
    const blocks = [...note.blocks]
    const [block] = blocks.splice(index, 1)
    blocks.splice(nextIndex, 0, block)
    commit(blocks)
    const input = blockRefs.current[id]
    focusBlock(id, input ? input.selectionStart : 'end')
  }

  function applyCommand(id: string, kind: BlockKind, fromSlash: boolean) {
    const block = note.blocks.find((item) => item.id === id)
    if (!block) return
    const content = fromSlash || kind === 'divider' ? '' : block.content
    const patch: Partial<NoteBlock> = { kind, content, checked: kind === 'checklist' ? false : undefined }
    setInsertMenuBlock(null)
    setDismissedSlashBlock(null)
    setMenuIndex(0)
    if (kind === 'divider') {
      // A divider has nothing to type into, so continue writing below it.
      addBlock('text', id, { patchCurrent: patch })
      return
    }
    updateBlock(id, patch)
    focusBlock(id)
  }

  function openInsertMenu(afterId: string) {
    setMenuIndex(0)
    setDismissedSlashBlock(null)
    addBlock('text', afterId, { content: '/' })
  }

  function handleMarkdownShortcut(event: React.KeyboardEvent<HTMLTextAreaElement>, block: NoteBlock) {
    if (event.key !== ' ' || block.kind !== 'text') return false
    const caret = event.currentTarget.selectionStart
    if (caret !== event.currentTarget.selectionEnd || caret !== block.content.length) return false
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

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>, block: NoteBlock, blockIndex: number) {
    const input = event.currentTarget
    const slashOpen = isSlashOpen(block)
    const menuOpen = slashOpen || insertMenuBlock === block.id
    const query = slashOpen ? block.content.slice(1) : ''
    const filtered = blockCommands.filter((command) => commandMatches(command, query))
    const mod = event.metaKey || event.ctrlKey

    if (event.key === 'Escape' && (menuOpen || actionsBlock === block.id)) {
      event.preventDefault()
      if (slashOpen) setDismissedSlashBlock(block.id)
      setInsertMenuBlock(null)
      setActionsBlock(null)
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
      applyCommand(block.id, filtered[Math.min(menuIndex, filtered.length - 1)].kind, slashOpen)
      return
    }
    if (mod && !event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      duplicateBlock(block.id)
      return
    }
    if (mod && event.shiftKey && event.key === 'ArrowUp') {
      event.preventDefault()
      moveBlock(block.id, -1)
      return
    }
    if (mod && event.shiftKey && event.key === 'ArrowDown') {
      event.preventDefault()
      moveBlock(block.id, 1)
      return
    }
    if (mod && event.key === '/') {
      event.preventDefault()
      setInsertMenuBlock(null)
      setActionsBlock((current) => (current === block.id ? null : block.id))
      return
    }
    if (handleMarkdownShortcut(event, block)) return

    const { selectionStart, selectionEnd } = input
    const collapsed = selectionStart === selectionEnd
    const plainKey = !mod && !event.altKey && !event.shiftKey

    if (plainKey && collapsed && event.key === 'ArrowUp' && selectionStart === 0 && blockIndex > 0) {
      event.preventDefault()
      focusBlock(note.blocks[blockIndex - 1].id, 'end')
      return
    }
    if (plainKey && collapsed && event.key === 'ArrowDown' && selectionEnd === block.content.length && blockIndex < note.blocks.length - 1) {
      event.preventDefault()
      focusBlock(note.blocks[blockIndex + 1].id, 'start')
      return
    }

    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (block.kind === 'text' && block.content === '---') {
        addBlock('text', block.id, { patchCurrent: { kind: 'divider', content: '' } })
        return
      }
      if (!block.content && structuralBlockKinds.includes(block.kind)) {
        updateBlock(block.id, { kind: 'text', checked: false })
        return
      }
      const nextKind = listBlockKinds.includes(block.kind) ? block.kind : 'text'
      if (flowingBlockKinds.includes(block.kind) && selectionEnd < block.content.length) {
        // Split the block at the caret, moving the remaining text to the new block.
        addBlock(nextKind, block.id, {
          content: block.content.slice(selectionEnd),
          patchCurrent: { content: block.content.slice(0, selectionStart) },
          caret: 'start',
        })
        return
      }
      addBlock(nextKind, block.id)
      return
    }

    if (event.key === 'Backspace' && collapsed && selectionStart === 0) {
      if (block.content === '') {
        event.preventDefault()
        if (block.kind !== 'text') updateBlock(block.id, { kind: 'text', checked: false })
        else removeBlock(block.id)
        return
      }
      if (block.kind !== 'text' && flowingBlockKinds.includes(block.kind)) {
        event.preventDefault()
        updateBlock(block.id, { kind: 'text', checked: false })
        focusBlock(block.id, 'start')
        return
      }
      const previous = note.blocks[blockIndex - 1]
      if (block.kind === 'text' && previous && flowingBlockKinds.includes(previous.kind)) {
        // Merge this paragraph into the previous text-like block.
        event.preventDefault()
        const junction = previous.content.length
        commit(note.blocks
          .filter((item) => item.id !== block.id)
          .map((item) => (item.id === previous.id ? { ...item, content: previous.content + block.content } : item)))
        focusBlock(previous.id, junction)
      }
    }
  }

  function isSlashOpen(block: NoteBlock) {
    return focusedBlock === block.id
      && dismissedSlashBlock !== block.id
      && block.content.startsWith('/')
      && !block.content.includes('\n')
      && block.content.length <= MAX_SLASH_QUERY
  }

  function finishDrag() {
    setDraggingId(null)
    setDropTarget(null)
  }

  function handleDrop() {
    const target = dropTarget
    const movingId = draggingId
    finishDrag()
    if (!movingId || !target || target.id === movingId) return
    const moving = note.blocks.find((block) => block.id === movingId)
    if (!moving) return
    const blocks = note.blocks.filter((block) => block.id !== movingId)
    const targetIndex = blocks.findIndex((block) => block.id === target.id)
    if (targetIndex < 0) return
    blocks.splice(target.position === 'before' ? targetIndex : targetIndex + 1, 0, moving)
    if (blocks.every((block, index) => block === note.blocks[index])) return
    commit(blocks)
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
    <section className="type-editor notion-editor" aria-label="Typed note editor" ref={editorRef}>
      <div
        className="blocks"
        onDragOver={(event) => {
          if (!draggingId) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(event) => {
          if (!draggingId) return
          event.preventDefault()
          handleDrop()
        }}
      >
        {note.blocks.map((block, blockIndex) => {
          const slashOpen = isSlashOpen(block)
          const menuOpen = slashOpen || insertMenuBlock === block.id
          const query = slashOpen ? block.content.slice(1) : ''
          const filteredCommands = blockCommands.filter((command) => commandMatches(command, query))
          const dropClass = dropTarget?.id === block.id && draggingId !== block.id ? `drop-${dropTarget.position}` : ''
          return (
            <div
              className={`editor-block kind-${block.kind} ${dropClass} ${draggingId === block.id ? 'is-dragging' : ''}`}
              key={block.id}
              onDragOver={(event) => {
                if (!draggingId) return
                const rect = event.currentTarget.getBoundingClientRect()
                const position: DropPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                setDropTarget((current) => (
                  current?.id === block.id && current.position === position ? current : { id: block.id, position }
                ))
              }}
            >
              <div className="block-gutter">
                <button className="block-add" onClick={() => openInsertMenu(block.id)} aria-label="Add block below" title="Add block below"><Plus size={16} /></button>
                <button
                  className="block-handle"
                  aria-label="Open block actions or drag to move"
                  title="Drag to move · click for actions"
                  aria-expanded={actionsBlock === block.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData(BLOCK_DRAG_TYPE, block.id)
                    const row = event.currentTarget.closest('.editor-block')
                    if (row instanceof HTMLElement) event.dataTransfer.setDragImage(row, 24, 16)
                    setActionsBlock(null)
                    setInsertMenuBlock(null)
                    setDraggingId(block.id)
                  }}
                  onDragEnd={finishDrag}
                  onClick={() => {
                    setInsertMenuBlock(null)
                    setActionsBlock((current) => (current === block.id ? null : block.id))
                  }}
                >
                  <GripVertical size={17} />
                </button>
              </div>

              {block.kind === 'checklist' && (
                <button className={`check-button ${block.checked ? 'checked' : ''}`} onClick={() => updateBlock(block.id, { checked: !block.checked })} aria-label={block.checked ? 'Mark incomplete' : 'Mark complete'} aria-pressed={Boolean(block.checked)}>
                  {block.checked && '✓'}
                </button>
              )}
              {block.kind === 'bullet' && <span className="list-marker" aria-hidden="true">•</span>}
              {block.kind === 'numbered' && <span className="list-marker numbered-marker" aria-hidden="true">{numberedPosition(blockIndex)}.</span>}
              {block.kind === 'quote' && <span className="quote-mark" aria-hidden="true">“</span>}
              {block.kind === 'math' && <span className="math-sigil" aria-hidden="true"><Braces size={15} /></span>}

              <div className="block-content">
                {block.kind === 'divider' && <hr className="notion-divider" />}
                <textarea
                  ref={(element) => { blockRefs.current[block.id] = element }}
                  rows={1}
                  value={block.content}
                  spellCheck={block.kind !== 'code' && block.kind !== 'math'}
                  onChange={(event) => {
                    const content = event.target.value
                    updateBlock(block.id, { content })
                    setMenuIndex(0)
                    if (insertMenuBlock === block.id) setInsertMenuBlock(null)
                    if (dismissedSlashBlock === block.id && !content.startsWith('/')) setDismissedSlashBlock(null)
                    autosizeBlock(event.target)
                  }}
                  onFocus={() => setFocusedBlock(block.id)}
                  onBlur={() => {
                    // Delay so menu clicks register before the slash menu unmounts; only clear
                    // if focus has not already moved to another block.
                    window.setTimeout(() => setFocusedBlock((current) => (current === block.id ? null : current)), 140)
                  }}
                  onKeyDown={(event) => handleKeyDown(event, block, blockIndex)}
                  placeholder={placeholderForBlock(block.kind, focusedBlock === block.id, note.blocks.length === 1)}
                  aria-label={`${blockLabels[block.kind]} block`}
                  className={`${block.checked ? 'completed' : ''} ${block.kind === 'divider' ? 'divider-input' : ''}`}
                />

                {block.kind === 'math' && <div className="math-preview"><MathPreview expression={block.content} /></div>}
                {!['math', 'divider', 'code'].includes(block.kind) && <InlineMathPreview content={block.content} />}

                {menuOpen && (
                  <NoteEditorCommandMenu
                    fromSlash={slashOpen}
                    query={query}
                    commands={filteredCommands}
                    selectedIndex={menuIndex}
                    onSelectIndex={setMenuIndex}
                    onApply={(kind) => applyCommand(block.id, kind, slashOpen)}
                  />
                )}

                {actionsBlock === block.id && (
                  <NoteEditorActionsMenu
                    onTurnInto={() => {
                      setActionsBlock(null)
                      setMenuIndex(0)
                      setInsertMenuBlock(block.id)
                      focusBlock(block.id)
                    }}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onDelete={() => removeBlock(block.id)}
                  />
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
