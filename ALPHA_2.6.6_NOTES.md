# Alpha 2.6.6 — Tree Frog and shared animation foundation

Based on Alpha 2.6.5 Looting / Croaks; retains A’jol project and wallet / corpse looting.

- Tree Frog (`tree`) uses tree-frog.glb in creation, equipment, and gameplay.
- Swamp Toad (`toad`) retains swamp-frog.glb. Other species keep their previous models.
- Tree Frog has 17 supplied clips. Swamp Toad retains 10 original clips and gains 17 clips named Tree_*.
- Retargeting converts local rotations using the two rigs’ inverse-bind rest orientations, preserves target limb lengths, and scales translation offsets. The runtime prefers Tree_* clips with original clips available as fallback.
- Heavy attacks map to Sword_Attack and the existing jump adapter maps to Jump_Start. This does not add new gameplay abilities or chain the three jump phases automatically.
- Independent cloned skeletons and cached species loads keep creator/equipment/gameplay state separate. Late loads cannot replace a newly selected species.

## Validation
Existing regression and map-project checks passed. Both real GLBs parsed, and all clips were sampled for finite skin deformation. Species routing, asynchronous switching, equipment sockets, and unequip visibility passed.
Browser visual review was blocked by the absence of Chromium. Check proportions, facing, feet, deformation, hand grips, and animation transitions in a playtest before considering the retargeted animations final.

## Item catalog audit
The separate 114-item items.json remains a design proposal and is not loaded by this build. Runtime equipment currently has 11 starter gear entries and corpse loot uses four placeholder materials, plus Croaks. Fitted armor and the full catalog integration remain pending. No item stats or loot balance changed in this release.

## Run
Serve this folder with `python3 -m http.server 8000` and open http://localhost:8000.
