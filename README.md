# Chill Notes

A calm, rose-toned note-taking app for typing, equations, sketches, and handwritten notes.

## MVP features

- Blank-page block editor with hover controls, drag reordering, Markdown shortcuts, and a filtered slash menu
- Inline LaTeX with `$...$` and dedicated KaTeX equation blocks
- Freeform canvas with pen, highlighter, eraser, color and stroke controls
- Drawing history, automatic local saving, and PNG export
- Multiple searchable notes, favorites, focus mode, and responsive navigation
- System-aware light and dark themes with persisted Light, Dark, and System preferences
- Browser-local persistence with no account required

The theme selector is in the sidebar under **Appearance**. System mode follows OS theme changes live; explicit Light and Dark choices are saved in the browser and applied before the app paints to avoid a theme flash.

## Run locally

```bash
npm install
npm run dev
```

Use `npm run build` for a production build and `npm run lint` for static checks.
