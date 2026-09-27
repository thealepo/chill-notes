export type BlockKind =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'checklist'
  | 'divider'
  | 'code'
  | 'math'

export interface NoteBlock {
  id: string
  kind: BlockKind
  content: string
  checked?: boolean
}

export interface Note {
  id: string
  title: string
  updatedAt: number
  favorite: boolean
  blocks: NoteBlock[]
  pageIcon?: string
  hasCover?: boolean
  drawing?: string
}

export type EditorMode = 'type' | 'draw'
export type DrawingTool = 'pen' | 'highlighter' | 'eraser'
