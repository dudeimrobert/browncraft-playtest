# Alpha 2.6.9 — Shroud of the Raccoon

First modular skinned armor test, based on Alpha 2.6.8.

## Quick test without changing your save

Serve the extracted game directory with `python3 -m http.server 8000` and open
http://localhost:8000/rig-test.html. Select Tree Frog or Swamp Toad. The Shroud
checkbox equips and removes the cloak. Use the animation selector, Pause,
Pose slider, front/side/back cameras, wireframe, and skin-weight view to inspect it.
This page does not grant items to, or modify, your character save.

## In the game

Shroud of the Raccoon is catalog item BC-ARM-0041. Acquire it through the existing
loot system, meet its normal level requirement, and equip it in the Back slot.
The correct fitted variant loads on Tree Frog or Swamp Toad. Unfinished species
still use the Tree Frog body and its matching shroud. Other back items remove
the shroud. The equipment overlay and gameplay use the same attachment module.
Other armor has not acquired a model in this release.

## Fitting and skinning

The source mesh had 266,924 vertices and 476,760 triangles. Each fitted variant
has 45,148 vertices and 69,642 triangles, with 1024-pixel texture maps.
Each GLB is approximately 3.88 MB, compared with the 21.43 MB source model.
Local vertex clustering retains UV chart boundaries at the chosen tolerance.
Fine silhouette features and texture detail have been reduced.

Each body has an independently fitted rest mesh and its original skeleton
convention. Hood weights blend head and neck. The collar follows neck and upper
spine. Lower cloth blends through three additional cloak bones rooted in the
upper spine. Weights are normalized and do not bind the cape across the legs.
Runtime attachments reuse the body's bones and original inverse bind matrices.
Cloak bones belong to each character instance. Small pose-driven cloak motions
and a sampled floor constraint supplement skeletal deformation.

This is an initial fitted prototype, not a cloth simulation or a collision-free
final asset. Runtime floor support is sampled. Body/arm clipping and cloth folds
must still be reviewed in the textured browser view, especially extreme casting,
death, attacks, and custom character proportions. No claim of a completed browser
playtest is made. No underlying body geometry is permanently removed.

## Verification

The regression suite covers map projects, species routing, inventory, stats, and
existing animation grounding. `node tools/verify-shroud.mjs` checks both actual
GLBs, normalized weights, finite animated garment vertices, lower hem height in
selected non-death poses, independent cloth bones, shared body bones, and
equip/unequip and asynchronous-load races. Geometry projection reviews were
performed for idle, walking and sword attacks. Browser visual QA remains.

The two GLBs contain the fitted mesh and rest skeleton for external editing.
They do not contain the frog body or duplicate animation clips. Use each with
its corresponding frog skeleton; the game supplies animation and secondary motion.
