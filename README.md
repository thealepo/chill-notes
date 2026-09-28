# Chill Notes

[![Quality](https://github.com/thealepo/chill-notes/actions/workflows/quality.yml/badge.svg)](https://github.com/thealepo/chill-notes/actions/workflows/quality.yml)

A calm, rose-toned note-taking app for typing, equations, sketches, and handwritten notes.

## MVP features

- Blank-page block editor with hover controls, drag reordering, Markdown shortcuts, and a filtered slash menu
- Inline LaTeX with `$...$` and dedicated KaTeX equation blocks
- Freeform canvas with pen, highlighter, eraser, color and stroke controls
- Drawing history, automatic local saving, and PNG export
- Multiple searchable notes, favorites, focus mode, and responsive navigation
- JSON backup import/export and per-note Markdown export
- System-aware light and dark themes with persisted Light, Dark, and System preferences
- Browser-local persistence with no account required

The theme selector is in the sidebar under **Appearance**. System mode follows OS theme changes live; explicit Light and Dark choices are saved in the browser and applied before the app paints to avoid a theme flash.

## Import and export

Open the workspace menu beside **Alex's space** to import a Chill Notes JSON backup or export every note as JSON. Imports are merged with the current workspace and receive fresh note and block IDs, so importing the same backup does not overwrite existing notes.

To export the active note as Markdown, open the note options menu in the top-right corner and choose **Export as Markdown**. Text blocks, headings, lists, checklists, quotes, code, dividers, and equations are converted to Markdown; canvas drawings are intentionally omitted and noted in an HTML comment.

## Run locally

```bash
npm ci
npm run dev
```

Run `npm run check` to execute the same lint and production-build checks as CI.
