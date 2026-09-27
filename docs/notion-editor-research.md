# Notion editor research notes

This feature uses Notion's public editor behavior as a reference while keeping Chill Notes' own visual identity.

## Official behavior reviewed

- New pages are blank canvases; icon and cover are optional: [Creating a page](https://www.notion.com/help/guides/creating-a-page)
- Page content is made from reorderable blocks with hover controls and slash insertion: [Writing and editing basics](https://www.notion.com/help/writing-and-editing-basics)
- Enter, Shift+Enter, Markdown prefixes, block movement, duplication, and slash commands are keyboard-first: [Keyboard shortcuts](https://www.notion.com/help/keyboard-shortcuts)
- Block and inline equations are rendered with KaTeX: [Math equations](https://www.notion.com/help/math-equations)
- Mobile replaces desktop hover behavior with persistent editing controls: [Notion for mobile](https://www.notion.com/help/notion-for-mobile)

## MVP behavior implemented

- Unboxed, centered blank document with optional icon and cover
- Hover/focus-only `+` and drag-handle controls with drag reordering
- Filtered, keyboard-navigable slash menu
- Paragraphs, three headings, bullets, numbered lists, to-dos, quotes, dividers, code, and block equations
- Markdown block shortcuts for headings, lists, to-dos, quotes, and dividers
- Enter/Shift+Enter behavior, list continuation, empty-list exit, duplicate, move, delete, and block conversion
- Inline `$...$` and `$$...$$` previews plus KaTeX display equations
- Bottom-sheet block menus on narrow screens

Rich-text selection across blocks, nesting, embeds, databases, and collaborative editing are intentionally outside this MVP.
