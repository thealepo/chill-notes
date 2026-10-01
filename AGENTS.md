# AGENTS.md

## Repository overview

Chill Notes is a browser-only note-taking SPA with two editing modes: a Notion-inspired block editor and a freeform drawing canvas. It is intentionally accountless and backend-free. Notes, settings, and drawings stay in browser storage; exports are the only built-in way to move data out of the browser.

The visual direction is calm and rose-toned, with responsive desktop/mobile layouts and light, dark, and system themes. Preserve that identity when changing UI. `docs/notion-editor-research.md` describes the Notion behaviors used as product inspiration, not a goal to clone Notion wholesale.

## Technology and commands

- React 18 with TypeScript and Vite 6
- Plain CSS in `src/styles.css`; there is no CSS framework or component library
- KaTeX for equation rendering
- Lucide React for icons
- ESLint 9 with TypeScript, React Hooks, and React Refresh rules
- npm lockfile; use `npm ci` for reproducible installs
- CI is configured for Node.js 22

Common commands:

```bash
npm ci
npm run dev
npm run lint
npm run build
npm run check
npm run preview
```

`npm run check` is the standard local verification and runs lint followed by the production build. The build uses TypeScript project references before Vite bundles the app. There is currently no automated test suite. `.github/workflows/quality.yml` is named "Lint and build," but at present it only checks out the repository, sets up Node 22, and runs `npm ci`; do not assume CI executes `npm run check` unless the workflow is extended.

## Repository map

- `index.html` — Vite shell and an inline pre-paint theme bootstrap that prevents a light/dark flash. Keep its storage-key and theme-color behavior aligned with `useTheme`.
- `src/main.tsx` — React entry point; imports global CSS and KaTeX CSS.
- `src/App.tsx` — application shell and top-level state. Owns notes, selection, filtering, sorting, archive/favorite behavior, menus, focus/sidebar state, persistence, note-level import/export, and the type/draw mode switch.
- `src/components/NoteEditor.tsx` — block editing, slash commands, Markdown shortcuts, keyboard behavior, drag ordering, block actions, and KaTeX previews.
- `src/components/DrawingCanvas.tsx` — pointer-based canvas tools, resize restoration, local undo/redo history, clearing, autosave callbacks, and PNG export.
- `src/components/ThemeSwitcher.tsx` — accessible system/light/dark radio control.
- `src/hooks/useTheme.ts` — theme preference persistence, system-theme observation, cross-tab storage updates, and DOM theme application.
- `src/lib/noteSerialization.ts` — storage migration, defensive JSON import parsing, Markdown rendering, and safe Markdown filenames.
- `src/types.ts` — canonical note, block, editor-mode, and drawing-tool types.
- `src/data.ts` — the single blank starter note used when storage is empty or unreadable.
- `src/styles.css` — all design tokens, layouts, editor/canvas styling, dark theme, responsive behavior, and reduced-motion handling. It includes older base rules followed by later Notion-style refinements; because later selectors intentionally override earlier ones, inspect the whole file before changing or removing a rule.
- `docs/notion-editor-research.md` — product behavior references and explicit MVP boundaries.
- `docs/screenshots/` — desktop light and mobile dark reference screenshots for portability and favorites UI.
- `README.md` — concise user-facing feature and setup documentation.

Generated directories such as `node_modules`, `dist`, and `.vite`, plus `*.tsbuildinfo`, are ignored and must not be committed.

## Data model and persistence

`Note` and `NoteBlock` in `src/types.ts` are the source of truth. A note contains its block array plus optional presentation/archive state and an optional canvas data URL. Supported block kinds are text, three heading levels, bullet, numbered, checklist, quote, divider, code, and math.

All notes are held in `App` state and the entire array is written to local storage under `chill-notes-v1` after changes. Theme preference is separate under `chill-notes-theme`; system mode is represented by removing that key. There is no server, router, database, authentication, or network data layer.

Important persistence behaviors:

- `readNotes()` falls back to `starterNotes` if stored JSON is absent or unreadable.
- Stored legacy `heading` blocks are migrated to `heading2` by `normalizeStoredNotes`.
- JSON imports must be arrays. Import validation is deliberately defensive and skips malformed notes or blocks.
- Imported notes and blocks receive new `crypto.randomUUID()` IDs, so imports merge rather than overwrite.
- A valid imported note must retain at least one valid block.
- Drawings are PNG data URLs stored directly on `Note.drawing`, so drawing-heavy workspaces can approach browser local-storage limits.
- Markdown export covers typed blocks only. If a note contains a drawing, export adds an HTML comment explaining that the drawing was omitted.

When adding a block kind or note field, update all relevant surfaces together: TypeScript types, editor creation/rendering and shortcuts, import validation/migration, Markdown serialization, duplication behavior, and styles. Consider backward compatibility for already-saved browser data.

## Editing behavior

The block editor is controlled: every edit calls `onChange` with a new note and refreshes `updatedAt`. Keep updates immutable.

- Typing `/` filters the command menu; arrow keys navigate and Enter applies the selected command.
- Markdown prefixes followed by Space convert text blocks into headings, lists, checklists, or quotes. Typing `---` then Enter creates a divider.
- Enter creates a following block, continuing list kinds; Shift+Enter inserts a newline.
- Enter on an empty structural block converts it to text. Backspace on an empty non-text block converts it to text; on an empty text block it removes the block, except that a note always keeps at least one block.
- Mod/Ctrl+D duplicates a block, Mod/Ctrl+Shift+Arrow moves it, and Mod/Ctrl+/ opens block actions.
- Blocks can also be reordered with HTML drag and drop.
- Inline `$...$` and `$$...$$` fragments receive a KaTeX preview; math blocks render as display equations. KaTeX output is the only content passed to `dangerouslySetInnerHTML`.

The canvas saves a full image snapshot when a pointer stroke ends. Its in-memory undo history is capped at 30 snapshots and is not persisted separately. `ResizeObserver` resizes the backing canvas and restores the latest image. Be careful with device-pixel-ratio transforms and with asynchronous `Image.onload` restoration.

## UI and accessibility conventions

- Reuse CSS custom properties from the light and dark token sets rather than introducing hard-coded colors. A small group of later Notion-style rules contains hard-coded neutrals; check both themes before expanding that pattern.
- The responsive breakpoints are primarily 920px and 700px. Verify desktop and narrow/mobile layouts after structural UI changes.
- Preserve the minimum 320px viewport support and the full-height, internally scrolling app shell.
- Keep icon-only controls labeled with `aria-label`. Preserve menu/dialog/tab/listbox roles, `aria-expanded`, `aria-selected`, `aria-pressed`, status announcements, focus-visible styling, and reduced-motion behavior.
- Use Lucide icons already in the dependency set rather than adding another icon source.
- Browser globals are expected, but storage can be unavailable. Theme storage access already degrades safely; maintain similar resilience for new preference storage.

## Change guidelines

- Keep feature orchestration in `App.tsx`, focused UI behavior in components/hooks, and pure import/export transformations in `src/lib`.
- Avoid adding a backend or state-management dependency for features that fit the current local-first architecture.
- Do not mutate note or block objects in place.
- Use Web APIs already supported by the configured ES2020/DOM target, or add an explicit compatibility strategy.
- Keep `index.html`'s pre-paint theme script synchronized with `src/hooks/useTheme.ts` if theme keys, accepted values, or colors change.
- Keep `README.md` current when user-visible features, export behavior, shortcuts, or setup commands change. Update `docs/notion-editor-research.md` only when editor scope or referenced behavior changes.
- Treat the screenshot files as documentation/reference assets, not runtime dependencies.

## Verification checklist

For every code change:

1. Run `npm run check`.
2. Exercise the changed flow in the browser because no automated interaction tests exist.
3. For editor changes, verify keyboard entry, focus movement, slash/action menus, drag ordering, and at least one narrow viewport.
4. For persistence/schema changes, load existing saved notes and round-trip a JSON export/import without losing valid data.
5. For Markdown changes, inspect headings, consecutive numbered/list blocks, checklists, multiline quotes, code containing backticks, equations, empty titles, and filename sanitization.
6. For canvas changes, verify resize preservation, pen/highlighter/eraser behavior, undo/redo, clear, autosave, and PNG export.
7. For theme or styling changes, verify light, dark, and system modes before and after reload, including mobile layout and keyboard focus indicators.
