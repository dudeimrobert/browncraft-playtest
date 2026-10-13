# Browncraft Alpha 2.6.0 — Character Forge foundation

- Four character classes only: Knight, Warlock (internally `caster` for save compatibility), Rogue, and Shaman. Existing Brute save data is still accepted as Knight fallback; it is not selectable for new characters.
- Six placeholder frog archetypes: Tree, Bull, Dart, Horned, Glass, Swamp Toad. Frogs are cosmetic; class determines starting stats.
- Creation UI includes frog selection, skin color, head and build controls, character name, four classes and a procedural rotating preview. Current body variation is primarily silhouette scaling and preview material tint, **not** six hand-authored GLBs.
- Starter equipment is automatically assigned by class. Equipment and bag are persisted under `browncraft-gear-v1:<character id>` independently of existing progress saves.
- Equipment menu allows unequip; Inventory menu and B-key bag allow equip. Replacing gear sends old gear back to bag; quest fragments and flasks are not equippable.
- Gear bonus totals are displayed in equipment UI as groundwork for combat-stat integration; **the existing combat formulas and in-world armor meshes are unchanged**. The original gameplay rig is preserved. No loot drops or crafting recipes are added yet.
- Existing character profiles receive a default Tree Frog appearance and starter gear on first use.
- QA: run `npm test`; open character selection, create four class profiles, equip/unequip, reload and check persistence.
