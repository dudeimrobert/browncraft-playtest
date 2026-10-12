# Alpha 2.5.8 · Realm Workshop

- Adds `level-editor.html`, an in-browser editor for all five current realms.
- Supports selection, move/rotate/resize handles, exact inspector fields, material tint, duplication, hiding, locking, undo/redo, snapping, top/3D views, and frame selection.
- Adds built-in model library plus self-contained GLB upload and portable embedded model exports.
- Saves drafts in IndexedDB; exports/imports a versioned JSON project with notes and per-realm collision overrides.
- Adds a game-side map project reader and isolated playtest mode. Applying an export as `assets/level-layout.json` updates the game directly.
- Keeps moved landmarks and Guardian spawn/home positions connected to gameplay. Groups tent/trader/anvil companion props around their anchors.
- Preserves A'jol tree instancing during edits. Editor uses demand rendering while idle.
- Adds a stable local editor launcher and `REALM_WORKSHOP_GUIDE.md`.
- Restores complete original Guardian GLBs that were truncated in the 2.5.7 archive.
- Adds editor/project checks and updates two legacy assertions for the already-existing Stillwater travel route.
