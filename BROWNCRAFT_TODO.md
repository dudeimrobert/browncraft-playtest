# Browncraft — Development To-do

## Asset creation — user
- [ ] **Generate six frog species GLB models:** Tree Frog, Bullfrog, Dart Frog, Horned Frog, Glass Frog, Swamp Toad.
- [ ] Each species: neutral A-pose or T-pose, forward-facing +Z convention documented, feet grounded at origin, clean topology, separate skin/eyes, consistent naming, ideally shared humanoid skeleton and known scale. Supply GLB plus reference image.
- [ ] Keep bodies compatible with all four classes: Knight, Warlock, Rogue, Shaman. No baked-in armor on the base frog meshes.

## Integration — assistant
- [ ] Import and retarget each real species model to a shared animation rig.
- [ ] Replace preview archetype scaling placeholders with selectable GLBs.
- [ ] Build class-independent armor fitting system: skeleton-mounted armor meshes and per-species fit profiles / offsets.
- [ ] Replace temporary class preview accent with starter gear meshes attached to the skeleton.
- [ ] Reflect equipped gear visually in the gameplay character and equipment preview.
- [ ] Validate collision, navigation and animations for different species sizes.

## Completed in 2.6.1
- [x] Four-class character creator and six placeholder frog archetypes.
- [x] Live frog/class preview displayed alongside character creation controls.
- [x] Inventory and equipment combined into side-by-side bag overlay, not a standalone menu tab.
- [x] Equipment slots arranged around character viewer; main/offhand slots beneath.
- [x] Items can be equipped from bag and unequipped back into bag, persisted per character.
