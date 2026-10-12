# Browncraft Alpha 2.5.8 · Realm Workshop

Built on Alpha 2.5.7 Stillwater / Static Water. The editor opens the actual game scenes, including A'jol, Weeping Fjarts, Stillwater Basin, Assfall Steppes, and Emberpood.

## Open the editor

Unzip this release. In Terminal, enter its folder and run:

```bash
python3 launch_editor.py
```

The editor opens at http://localhost:8080/level-editor.html. Keep Terminal open. Use this same address to recover your browser draft next time. The editor needs an internet connection for the existing Three.js CDN imports.

After deploying this build through your existing GitHub/Netlify workflow, use the **Realm Workshop** link on the game page, or append `/level-editor.html` to the playtest site's address.

## Arrange a realm

1. Choose the realm at the top.
2. Select an object in the scene or in the searchable object list.
3. Drag the colored handles to move, rotate, or resize. W/E/R switch tools.
4. Use the inspector for exact position, height, rotation, scale, and color. Tree scale 1 is its original size; 1.2 is 20% larger. Keep proportions preserves the object's shape.
5. Use Top view for layout, 3D view for composition, and F to frame a selection. Right-drag pans; scroll zooms. Grid snapping can be disabled for organic placement.
6. Duplicate scenery with Shift+D. Hide removes scenery visually. Lock protects finished objects. Undo/redo use Command/Ctrl+Z and Command/Ctrl+Shift+Z.

The Pootal, Brownwell, merchant, tent, and anvil retain their gameplay interactions when moved. The merchant's stall/bag, tent fire, and anvil forge move with their anchor. Protected gameplay objects cannot be hidden or duplicated in the editor. Guardian and enemy movement updates their spawn/home location; editing does not redesign combat.

## Add models

Click **Upload GLB models**. Use self-contained GLB version 2 files with embedded textures, up to 100 MB each. The library stores the model in the project. Choose a model, then click the terrain to place it. New imports are normalized to a useful initial size and can be resized afterward. Escape cancels placement.

The built-in library includes A'jol trees, willows, Ember mushrooms, the fountain, boulders, and ruin pillars. A'jol's original trees remain instanced when edited; duplicating them uses the existing geometry without embedding giant mesh arrays in the export.

## Fix navigation

**Blocked tiles** shows the current collision grid: red is blocked, green is traversable. Click an interior tile to toggle it. Outer boundaries stay protected. Tile edits are saved with each realm and support undo/redo.

Objects do not automatically create collision or a walkable platform. Use the tile tool to block large scenery footprints or clear intended routes. This first editor supports object placement and cell navigation; it does not sculpt terrain, paint ground textures, or author new raised walkable surfaces. Stillwater's existing dock navigation remains part of the baseline.

## Save, playtest, and communicate changes

Edits automatically save a draft in this browser using IndexedDB. Export regularly for a portable backup; browser drafts are specific to the browser and site address and can be cleared by browser settings.

**Playtest layout** opens the current realm in the game with the project applied. Start/select a Knight normally. Preview mode opens all realms and does not write character progress. Very large projects may exceed the browser's preview storage; export and install the layout file to test those.

Use Project name and Notes to describe what changed. Click **Export project** to download `Browncraft_Level_Project.json`. It includes every edited realm, transformations, tints, hidden/locked objects, collision overrides, notes, and uploaded GLB bytes. Send this one JSON file back to the Browncraft conversation. A saved view PNG is optional context.

To install changes yourself:

1. Rename the exported JSON to `level-layout.json`.
2. Replace this build's `assets/level-layout.json` with it.
3. Commit/push the build using the usual GitHub/Netlify workflow.
4. Open the deployed game and verify the changed realm.

**Open project** reloads an exported JSON in the editor. Projects target the 2.5.7 scene baseline preserved in this release. Future major scene changes may need a migration before applying old exports.

## Source asset repair

Three Guardian GLBs in the supplied 2.5.7 ZIP were truncated. This release restores the complete original Mournwillow, Vuldross, and Cindergut models. No Guardian redesign is included.

## Validation

Run `npm ci` then `npm test`. The checks cover the existing gameplay regression suite plus stable editor IDs, landmark assemblies, tree instance transforms/tints, export/import, collision overrides, malformed project rejection, and complete Guardian assets.
