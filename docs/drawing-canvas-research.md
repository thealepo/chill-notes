# Drawing canvas research

This note records the product and engineering references used for the expanded
Chill Notes drawing canvas. The goal is not to clone any one product. It is to
adopt the interaction patterns that fit a calm, browser-only notes app.

## What the reference products reveal

### Excalidraw

Excalidraw persists a versioned JSON scene whose core is an array of typed
elements plus application state and attached files. Its public change callback
also separates scene elements from application state. That boundary is useful:
document data can be saved and placed in history while transient state such as
the active tool, viewport, and selection can remain local to the editor.

Its source uses a dedicated store/history layer, renders freehand elements from
stored points, and ships `perfect-freehand` for natural ink. The product exposes
selection, hand/pan, free draw, text, line, arrow, rectangle, ellipse, and other
object tools. Keyboard modifiers constrain angles or proportions.

Relevant primary sources:

- [Excalidraw JSON schema](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/codebase/json-schema.mdx)
- [Excalidraw component API](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/%40excalidraw/excalidraw/api/props/props.mdx)
- [Excalidraw history implementation](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts)
- [Excalidraw package dependencies](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/package.json)

### Noteful

Noteful describes its ink as high-resolution vector ink rather than a flattened
page bitmap. Its editing model includes a lasso that moves and resizes marks,
multiple pen styles, shape recognition, independently visible/reorderable
layers, and multiple paper templates. These are strong signals that strokes and
annotations are retained as editable objects and composited for display/export.

Relevant primary source:

- [Noteful App Store product description](https://apps.apple.com/us/app/noteful-notes-pdf-markup/id1587904334)

### Apple Freeform

Freeform combines drawing with board objects. Users can select drawn marks with
a lasso, place text and shapes, connect objects, and work on a spatial canvas.
Its diagram workflow keeps connectors attached to connection points on shapes.
The draw-and-hold gesture that straightens a sketch also demonstrates the value
of preserving a stroke long enough to interpret it before rasterizing.

Relevant primary sources:

- [Draw or handwrite on a Freeform board](https://support.apple.com/guide/iphone/draw-or-handwrite-iphe749c1957/ios)
- [Add a diagram on a Freeform board](https://support.apple.com/guide/freeform/add-a-diagram-frfm1e6c3d3e/mac)

## Architecture for Chill Notes

The existing canvas saves a PNG after every stroke. That is simple, but pixels
cannot be selected, recolored, moved, or scaled cleanly. The expanded canvas
uses a small versioned scene document instead:

- Durable state: ordered vector elements and paper style.
- Transient state: selection, active tool, viewport pan/zoom, pointer gesture,
  and open UI.
- History: whole-scene snapshots at completed user-action boundaries. Pointer
  moves never create history entries.
- Rendering: a high-DPI canvas redrawn from the scene. A separate interaction
  overlay supplies selection handles and live previews.
- Compatibility: an existing PNG drawing becomes a locked background element
  the first time it is opened; new notes save the versioned scene JSON.
- Persistence: the scene remains in the existing `Note.drawing` string so old
  backups and storage continue to work without a schema migration.

## Initial product scope

The first expanded version includes select/move/delete, hand pan, wheel zoom,
pressure-aware pen and highlighter strokes, whole-object erasing, rectangle,
ellipse, line, arrow, text, sticky notes, paper templates, undo/redo, keyboard
shortcuts, and PNG export. It keeps the local-first model and avoids media,
collaboration, OCR, audio, and cloud synchronization.

This deliberately establishes an editable scene foundation. Grouping, true
multi-selection/lasso geometry, connector binding, layers, image/PDF import,
and collaborative deltas can be added later without another persistence reset.
