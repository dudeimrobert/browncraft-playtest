# Alpha 2.4.8 — Trader Billboard

This update replaces A’jol’s procedural merchant figure with the supplied cardboard Trader artwork while retaining the A’jol tree replacement and complete death-and-respawn flow.

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
