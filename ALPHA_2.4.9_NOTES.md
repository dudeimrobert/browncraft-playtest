# Alpha 2.4.9 — GPU Performance Pass

This update retains the A’jol Trader billboard, imported trees, and gameplay from 2.4.8 while reducing rendering work across the game.

## Performance changes

- Adaptive render resolution: starts at at most 1.25 device pixels per CSS pixel, adjusts every two seconds toward the current frame rate, and stays within 0.75–1.25. This lowers full-screen pixel/shader work on high-density displays.
- Distant guardians switch to a small procedural silhouette until the camera approaches; their full models and combat rigs remain in place up close. The hero model is intentionally unchanged to preserve animation and texture quality.
- The sun shadow map drops from 1024 to 768 pixels. Static scenery and A’jol tree instances no longer cast expensive realtime shadows; active characters still can.
- A’jol’s imported GLB tree meshes render in instanced batches instead of a separate set of draw calls per tree. Their deterministic height, rotation, and width variation remain.
- Zone cleanup retains imported shared geometry/materials across realm transitions and releases instance buffers.

The actual FPS improvement depends on browser, GPU, resolution, and realm. This is a conservative pass, not a claim that all character meshes have been decimated.

## Changes

- Added the supplied Trader PNG as a camera-facing A’jol character billboard.
- Keyed the baked neutral checkerboard to transparency at runtime while preserving the cardboard, ink, tape, and painted details.
- Added two shallow silhouette layers to give the billboard visible cardboard thickness.
- Added a soft terrain contact shadow so the character feels grounded.
- Preserved the merchant stall, supply bag, interaction radius, and trade behavior.
- Added `fantasy-x-tree-08.glb` as an A’jol-specific environment model.
- Replaced every runtime procedural tree placement in A’jol with the new model.
- Added deterministic randomized rotation, 5.1–8.0-unit height variation, and subtle width variation for a natural grove.
- Kept Weeping Fjarts’ willow vegetation unchanged.
- Fatal damage immediately clears target lock, boss HUD, active attacks, Mournwillow AoEs, slow state, and combat input.
- The viewport fades to black and displays **You Died**.
- **Continue at A’jol** rebuilds A’jol, restores health, stamina, Brown Reserve, and flasks, and preserves character progression.
- **Quit to Character Select** returns to the existing roster without deleting progress.
- Death immediately checkpoints the character’s next load at A’jol, so quitting or reloading cannot strand a dead character in an outer realm.
- Removed the undocumented `R` in-place reset shortcut.

## Verification

- Automated checks cover the trader texture, keyed billboard construction, camera-facing behavior, tree asset, death cleanup, A’jol checkpoint, progression preservation, and modal controls.
