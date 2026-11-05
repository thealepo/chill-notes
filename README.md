# Chill Notes

[![Quality](https://github.com/thealepo/chill-notes/actions/workflows/quality.yml/badge.svg)](https://github.com/thealepo/chill-notes/actions/workflows/quality.yml)

A calm, local-first note-taking PWA for writing, equations, sketches, and handwritten notes.

## Phase 1

- Notion-inspired block editor with Markdown shortcuts, slash commands, drag ordering, and KaTeX
- Editable vector canvas with pressure ink, shapes, text, sticky notes, history, zoom, and PNG export
- Searchable notes with favorites, archive, focus mode, icons, and covers
- JSON backup/import and per-note Markdown export
- IndexedDB persistence, cross-tab synchronization, recovery tools, and storage warnings
- Responsive light, dark, and system themes
- Installable, offline-capable desktop and mobile PWA

## Privacy and storage

Chill Notes has no accounts or backend. Notes and drawings remain in browser storage unless you export them. Clearing site data or uninstalling the app can remove local notes, so download JSON backups regularly from **Workspace options**.

## Development

Requires Node.js 22.

```bash
npm ci
npm run dev
```

Install Chromium once, then run the full CI-equivalent verification:

```bash
npx playwright install chromium
npm run check
```

Additional commands:

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
npm run generate:icons
```

See [Dependency security](docs/dependency-security.md) for audit details.
