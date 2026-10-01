# Chill Notes

[![Quality](https://github.com/thealepo/chill-notes/actions/workflows/quality.yml/badge.svg)](https://github.com/thealepo/chill-notes/actions/workflows/quality.yml)

A calm, rose-toned note-taking app for typing, equations, sketches, and handwritten notes.

## MVP features

- Blank-page block editor with hover controls, drag reordering, Markdown shortcuts, and a filtered slash menu
- Inline LaTeX with `$...$` and dedicated KaTeX equation blocks
- Editable vector canvas with pressure-aware pen and highlighter ink, whole-object erasing, shapes, arrows, text, and sticky notes
- Select, move, resize, duplicate, reorder, pan, zoom, switch paper templates, undo/redo, and export the full board as PNG
- Multiple searchable notes, favorites, focus mode, and responsive navigation
- JSON backup import/export and per-note Markdown export
- System-aware light and dark themes with persisted Light, Dark, and System preferences
- Browser-local persistence with no account required

The theme selector is under **Settings → Appearance** in the sidebar. System mode follows OS theme changes live; explicit Light and Dark choices are saved in the browser and applied before the app paints to avoid a theme flash.

## Editing shortcuts

- `/` opens the block menu (arrow keys to navigate, Enter to apply, Esc to close)
- Markdown prefixes followed by Space (`#`, `##`, `###`, `-`, `1.`, `[]`, `"`) convert a block; `---` then Enter adds a divider
- Enter splits the block at the cursor (lists continue); Shift+Enter inserts a newline
- Backspace at the start of a block turns it back into text, or merges a paragraph into the block above
- Arrow Up/Down at the start/end of a block moves to the neighbouring block
- Mod+D duplicates a block, Mod+Shift+Arrow moves it, Mod+/ opens block actions
- `N` creates a note and Mod+K focuses search (Mod is ⌘ on macOS, Ctrl elsewhere)

## Drawing shortcuts

- `V` Select, `H` Hand, `P` Pen, `M` Highlighter, and `E` Eraser
- `R` Rectangle, `O` Ellipse, `L` Line, `A` Arrow, `T` Text, and `S` Sticky note
- Hold Space and drag to pan; use Mod+wheel or the canvas controls to zoom
- Hold Shift while drawing or resizing to constrain proportions
- Delete/Backspace removes the selected object; Mod+Z and Mod+Shift+Z undo and redo
- Double-click text or a sticky note to edit it

## Import and export

Open the workspace menu beside **Alex's space** to import a Chill Notes JSON backup or export every note as JSON. Imports are merged with the current workspace and receive fresh note and block IDs, so importing the same backup does not overwrite existing notes.

To export the active note as Markdown, open the note options menu in the top-right corner and choose **Export as Markdown**. Text blocks, headings, lists, checklists, quotes, code, dividers, and equations are converted to Markdown; canvas drawings are intentionally omitted and noted in an HTML comment. The drawing toolbar exports the full board as a PNG. Chill Notes backups preserve the editable vector scene, and sketches saved by older versions continue to open as a locked background.

## Run locally

```bash
npm ci
npm run dev
```

Run `npm run check` to execute the same lint and production-build checks as CI.
