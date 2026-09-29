# Alpha 2.4.5 — Return Passage & Mournwillow Encounter

## GitHub-ready Frog Knight update

- Reduced the Frog Knight's in-world scale from 1.30 to 1.15 (about 12% smaller).
- Resized embedded hero textures from 2048px to 1024px while retaining the full 29-bone rig and original mesh geometry.
- Reduced the active Frog Knight GLB from 29.6 MB to 21.8 MB.
- Excluded unused Frog source/T-pose assets and an orphaned Guardian temp file from the deployable release.
- Kept every packaged file below 25 MiB for GitHub browser uploads.

This build keeps the supplied **Swamp Meadow Crossroads Tile** as A’jol’s dedicated ground texture and adds the next combat/progression pass.

## Changes

- Every entered outer realm can immediately Pootal back to A’jol; boss sigils still gate forward realm progression.
- Engaged bosses now receive a wide, bottom-screen health bar with their name and active channel status.
- Mournwillow’s Bough Sweep windup is now 1.15 seconds (up from 0.86).
- Every third Mournwillow attack cycle invokes **Weeping Fall**, a randomized 3–5 second channel that marks seven AoE impacts around her. An undodged hit deals 8–12 damage and slows movement by 50% for 1.5 seconds.
- Brown Bolt damage is now 12–17 (down from 13–18).
- A persistent spell HUD shows the selected Brown spell, a distinct Bolt/Mend icon, and the E/Q controls.

## A’jol ground

The supplied **Swamp Meadow Crossroads Tile** is now A’jol’s dedicated ground texture.

- Runtime asset: `assets/ajol/ajol-ground-crossroads.png`
- Dimensions: 1254 × 1254 RGBA
- The texture has a complete PNG data stream and is checked by the verification suite.
- The visual surface remains separate from `map-hearth-bf.png`, which continues to drive terrain classification, elevation, collision, and walkability.

The old incomplete stitched A’jol color and normal exports remain excluded from release packaging.
