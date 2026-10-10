import { ChevronRight, Copy, Pilcrow, Trash2, Type } from 'lucide-react'
import { modKeyLabel } from '../lib/platform'
import type { BlockKind } from '../types'
import type { BlockCommand } from './noteEditorConfig'

interface NoteEditorCommandMenuProps {
  fromSlash: boolean
  query: string
  commands: BlockCommand[]
  selectedIndex: number
  onSelectIndex: (index: number) => void
  onApply: (kind: BlockKind) => void
}

export function NoteEditorCommandMenu({
  fromSlash,
  query,
  commands,
  selectedIndex,
  onSelectIndex,
  onApply,
}: NoteEditorCommandMenuProps) {
  let currentGroup = ''
  return (
    <div className="slash-menu" role="listbox" aria-label={fromSlash ? 'Insert a block' : 'Turn block into'}>
      <div className="slash-search"><Pilcrow size={14} /><span>{query ? `Results for “${query}”` : fromSlash ? 'Choose a block' : 'Turn into'}</span></div>
      <div className="slash-results">
        {commands.map((command, index) => {
          const Icon = command.icon
          const showGroup = command.group !== currentGroup
          currentGroup = command.group
          return (
            <div key={command.kind}>
              {showGroup && <div className="slash-title">{command.group}</div>}
              <button
                className={index === selectedIndex ? 'selected' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => onSelectIndex(index)}
                onClick={() => onApply(command.kind)}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <span className="command-icon"><Icon size={17} /></span>
                <span><strong>{command.label}</strong><small>{command.description}</small></span>
                <ChevronRight size={14} />
              </button>
            </div>
          )
        })}
        {commands.length === 0 && <div className="no-command-results">No blocks found</div>}
      </div>
      <div className="slash-footer"><span>↑↓ navigate</span><span>↵ select</span><span>esc close</span></div>
    </div>
  )
}

interface NoteEditorActionsMenuProps {
  onTurnInto: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function NoteEditorActionsMenu({ onTurnInto, onDuplicate, onDelete }: NoteEditorActionsMenuProps) {
  return (
    <div className="block-actions-menu" role="menu" aria-label="Block actions">
      <div className="slash-title">Block actions</div>
      <button role="menuitem" onClick={onTurnInto}><Type size={15} />Turn into…</button>
      <button role="menuitem" onClick={onDuplicate}><Copy size={15} />Duplicate <kbd>{modKeyLabel}+D</kbd></button>
      <button role="menuitem" className="danger" onClick={onDelete}><Trash2 size={15} />Delete</button>
    </div>
  )
}
