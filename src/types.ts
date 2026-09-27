export type BlockKind = 'text' | 'heading' | 'quote' | 'checklist' | 'math'

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
  drawing?: string
}

export type EditorMode = 'type' | 'draw'
export type DrawingTool = 'pen' | 'highlighter' | 'eraser'
