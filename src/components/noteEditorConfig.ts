import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  Type,
} from 'lucide-react'
import type { BlockKind } from '../types'

export interface BlockCommand {
  kind: BlockKind
  label: string
  description: string
  aliases: string[]
  group: 'Basic blocks' | 'Advanced'
  icon: typeof Type
}

export const blockCommands: BlockCommand[] = [
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

export const listBlockKinds: BlockKind[] = ['bullet', 'numbered', 'checklist']
export const structuralBlockKinds: BlockKind[] = ['heading1', 'heading2', 'heading3', 'bullet', 'numbered', 'checklist', 'quote', 'code']
export const flowingBlockKinds: BlockKind[] = ['text', 'heading1', 'heading2', 'heading3', 'bullet', 'numbered', 'checklist', 'quote']
export const blockLabels = Object.fromEntries(blockCommands.map((command) => [command.kind, command.label])) as Record<BlockKind, string>

export function commandMatches(command: BlockCommand, query: string) {
  const haystack = [command.label, command.description, ...command.aliases].join(' ').toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

export function placeholderForBlock(kind: BlockKind, focused: boolean, onlyBlock: boolean) {
  switch (kind) {
    case 'math': return 'Type LaTeX…'
    case 'code': return 'Write some code…'
    case 'heading1': return 'Heading 1'
    case 'heading2': return 'Heading 2'
    case 'heading3': return 'Heading 3'
    case 'divider': return ''
    default:
      if (!focused && !onlyBlock) return ''
      if (kind === 'bullet' || kind === 'numbered') return 'List'
      if (kind === 'checklist') return 'To-do'
      if (kind === 'quote') return 'Quote'
      return "Type '/' for commands"
  }
}

