# Chill Notes

[![Quality](https://github.com/thealepo/chill-notes/actions/workflows/quality.yml/badge.svg)](https://github.com/thealepo/chill-notes/actions/workflows/quality.yml)

A calm, rose-toned note-taking app for typing, equations, sketches, and handwritten notes.

## MVP features

- Blank-page block editor with hover controls, drag reordering, Markdown shortcuts, and a filtered slash menu
- Inline LaTeX with `$...$` and dedicated KaTeX equation blocks
- Editable vector canvas with pressure-aware pen and highlighter ink, whole-object erasing, shapes, arrows, text, and sticky notes
- Select, move, resize, duplicate, reorder, pan, zoom, switch paper templates, undo/redo, and export the full board as PNG
- PNG export reports and skips an unavailable legacy background image instead of blocking the export
- Multiple searchable notes, favorites, focus mode, and responsive navigation
- One-click JSON recovery backups, defensive import, and per-note Markdown export
- Conflict-safe synchronization between open browser tabs
- System-aware light and dark themes with persisted Light, Dark, and System preferences
- IndexedDB persistence with automatic localStorage migration, capacity warnings, and no account required
- Installable mobile/desktop PWA with an offline app shell, adaptive icons, safe-area layouts, and touch-friendly controls

The theme selector is under **Settings → Appearance** in the sidebar. System mode follows OS theme changes live; explicit Light and Dark choices are saved in the browser and applied before the app paints to avoid a theme flash.

Notes and drawings are saved in IndexedDB, which provides substantially more room than localStorage for drawing-heavy workspaces. Existing `chill-notes-v1` localStorage data moves automatically on first load. The workspace menu shows the browser's storage estimate when available; if capacity gets low or saving fails, Chill Notes keeps the current tab usable and presents a **Download backup** action for immediate recovery.

## Install and use offline

After the first successful online visit, Chill Notes caches the app shell, editor, drawing tools, fonts, and icons for offline use. In browsers that expose an install prompt, open **Workspace options → Install Chill Notes**. On iPhone or iPad, open the same menu for **Add to Home Screen** guidance, then use Safari's Share menu.

Updates are never applied in the middle of editing without permission. When a fresh version is ready, choose **Update now** from the in-app notice; notes remain in IndexedDB through the update. Notes are still device-local, so download a JSON backup before clearing browser data or removing the app if you need to preserve them.

## Editing shortcuts

- `/` opens the block menu (arrow keys to navigate, Enter to apply, Esc to close)
- Markdown prefixes followed by Space (`#`, `##`, `###`, `-`, `1.`, `[]`, `"`) convert a block; `---` then Enter adds a divider
- Enter splits the block at the cursor (lists continue); Shift+Enter inserts a newline
- Backspace at the start of a block turns it back into text, or merges a paragraph into the block above
- Arrow Up/Down at the start/end of a block moves to the neighbouring block
- Mod+D duplicates a block, Mod+Shift+Arrow moves it, Mod+/ opens block actions
- `N` creates a note and Mod+K focuses search (Mod is ⌘ on macOS, Ctrl elsewhere)

## Drawing shortcuts

- Tab to the canvas, then press `V` and Enter to select an object; Enter selects the next object and Shift+Enter selects the previous one
- Arrow keys move the selected object by one pixel; hold Shift to move it by ten pixels
- Press `R`, `O`, `L`, `A`, `T`, or `S`, then Enter, to create a rectangle, ellipse, line, arrow, text box, or sticky note at the visible center
- Delete or Backspace removes the selected object, and Escape clears the selection
- Mod+Z undoes, Mod+Shift+Z redoes, `+`/`-` zoom, and Space temporarily enables panning while the canvas is focused

## Run locally

```bash
npm ci
npm run dev
```

Run `npx playwright install chromium` once to install the browser used by the interaction tests. Then run `npm run check` to execute the same lint, Node tests, production build, and Playwright browser tests as CI. Use `npm run test:e2e` to run only the production build and browser tests.

Launcher PNGs are generated reproducibly from the SVG sources in `public/icons/`. After changing that artwork, run `npm run generate:icons` and commit the refreshed assets.

## Future Features

- [ ] LLM Integration -- gets specific notes and draws from them to create sample quizzes, answer questions, etc.
- [X] Fix the UI bug where when one does a text box it is seen double.
- [ ] Tighten up the codebase and any unsafe/buggy/unstable code
- [X] Ship an installable, offline-capable mobile PWA
