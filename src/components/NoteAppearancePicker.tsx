import { Trash2, X } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  MAX_NOTE_ICON_LENGTH,
  normalizeNoteIcon,
  NOTE_COVER_OPTIONS,
  NOTE_ICON_OPTIONS,
} from '../lib/noteAppearance'
import type { NoteCover } from '../types'

interface NoteAppearancePickerProps {
  kind: 'icon' | 'cover'
  currentIcon?: string
  currentCover?: NoteCover
  onClose: () => void
  onSelectIcon: (icon: string | undefined) => void
  onSelectCover: (cover: NoteCover | undefined) => void
}

export function NoteAppearancePicker({
  kind,
  currentIcon,
  currentCover,
  onClose,
  onSelectIcon,
  onSelectCover,
}: NoteAppearancePickerProps) {
  const customIconId = useId()
  const [customIcon, setCustomIcon] = useState(currentIcon ?? '')
  const isIconPicker = kind === 'icon'

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function submitCustomIcon(event: FormEvent) {
    event.preventDefault()
    const nextIcon = normalizeNoteIcon(customIcon)
    if (!nextIcon) return
    onSelectIcon(nextIcon)
  }

  return (
    <section
      className={`page-appearance-picker is-${kind}`}
      role="dialog"
      aria-label={isIconPicker ? 'Choose a page icon' : 'Choose a page cover'}
    >
      <div className="appearance-picker-heading">
        <div>
          <strong>{isIconPicker ? 'Choose an icon' : 'Choose a cover'}</strong>
          <span>{isIconPicker ? 'Pick a favorite or use your own symbol.' : 'Set the mood for this note.'}</span>
        </div>
        <button className="appearance-picker-close" onClick={onClose} aria-label={`Close ${kind} picker`}>
          <X size={16} />
        </button>
      </div>

      {isIconPicker ? (
        <>
          <div className="icon-choice-grid" aria-label="Icon choices">
            {NOTE_ICON_OPTIONS.map((icon) => (
              <button
                key={icon}
                className="icon-choice"
                onClick={() => onSelectIcon(icon)}
                aria-label={`Use ${icon} as page icon`}
                aria-pressed={currentIcon === icon}
              >
                {icon}
              </button>
            ))}
          </div>
          <form className="custom-icon-form" onSubmit={submitCustomIcon}>
            <label htmlFor={customIconId}>Custom emoji or symbol</label>
            <div>
              <input
                id={customIconId}
                value={customIcon}
                onChange={(event) => setCustomIcon(event.target.value)}
                maxLength={MAX_NOTE_ICON_LENGTH}
                placeholder="Paste an emoji"
                autoComplete="off"
              />
              <button type="submit" disabled={!normalizeNoteIcon(customIcon)}>Use icon</button>
            </div>
          </form>
          {currentIcon && (
            <button className="appearance-remove" onClick={() => onSelectIcon(undefined)}>
              <Trash2 size={15} />Remove icon
            </button>
          )}
        </>
      ) : (
        <>
          <div className="cover-choice-grid" aria-label="Cover choices">
            {NOTE_COVER_OPTIONS.map((cover) => (
              <button
                key={cover.id}
                className="cover-choice"
                data-cover={cover.id}
                onClick={() => onSelectCover(cover.id)}
                aria-pressed={currentCover === cover.id}
              >
                <span>{cover.label}</span>
              </button>
            ))}
          </div>
          {currentCover && (
            <button className="appearance-remove" onClick={() => onSelectCover(undefined)}>
              <Trash2 size={15} />Remove cover
            </button>
          )}
        </>
      )}
    </section>
  )
}
