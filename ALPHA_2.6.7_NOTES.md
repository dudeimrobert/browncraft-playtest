# Alpha 2.6.7 — Item catalog core integration

Built from 2.6.6; includes Tree Frog, retargeted Swamp Toad, A’jol layout, editor, Croaks, and corpse looting.

## Active now
- All 114 source catalog entries have stable IDs and are registered at runtime.
- Open Inventory (B), then Item catalog to search the full read-only list.
- Equipment supports head, chest, hands, legs, feet, shoulders, back, neck, two rings, belt, main hand and offhand. The old accessory slot remains for save compatibility.
- Two-handed and paired weapons reserve both hands and return conflicting gear to inventory. Equipping an offhand returns a two-handed weapon to the bag. Two rings can be equipped independently, including two copies of the same ring.
- Level requirements block equipping. Inventory keeps duplicate IDs as individual owned units; bag display groups stackables up to max_stack without deleting overflow. Bag display expands beyond 30 entries.
- Enemy drops use catalog rarity weights (common 60, uncommon 28, rare 10, epic 1.8, legendary 0.2), matching enemy pools and player level. Bosses include elite_enemy candidates. Quest items never roll randomly. Death still rolls once; taking an item removes it from that corpse.
- New collected items save alongside existing gear under the existing character-bound gear key. Old starter gear, collected placeholder materials, Croaks, and progression saves remain valid. No items are automatically granted by browsing the catalog.

## Flat stat rules
- HP / STA: added to maximum health / stamina.
- BRC: added to maximum Brown Reserve and spell hit damage.
- ATK: added to melee and charge hit damage.
- DEF: flat reduction after blocking, before shield absorption; minimum 1 damage.
- EVA: percentage-point evade chance, clamped to 0–75%.
- CRIT: percentage-point critical chance, clamped to 0–100%; critical hits deal 1.5x damage.
- Existing starter gear bonuses now contribute to derived stats too.
Equipment changes recompute derived values from base progression. They cannot stack permanent bonuses or refill resources through repeated equip/unequip. These are initial implementation rules and require balance playtesting.

## Pending, clearly marked in UI
Special effects, set bonuses, consumable use, crafting/durability, selling/trading, new merchant/chest/resource-node interactions, and unique quest spawns are not implemented. Catalog entries for those systems are registered and can be stored, but their descriptive effects are inactive. Quest entries are discoverable in the catalog, not awarded by a new quest system. Armor meshes and dedicated item icons are not assigned; category glyphs are placeholders. No automatic claim is made that equipped armor changes character appearance.

## Validation
Regression, level-project, both rig tests, and new item-system tests passed. Item tests cover slot conflicts, dual rings, level rejection, stacks, save serialization, level/pool loot eligibility, actual engine derived stats, physical/spell damage, and defense. Browser visual testing remains pending (Chromium unavailable); check the expanded inventory UI and both characters in game.

## Playtest
1. Create/select Tree Frog and Swamp Toad; confirm the correct models.
2. Defeat enemies and collect catalog loot; inspect names, rarity, level, and inactive-effect labels.
3. Equip eligible items and verify stats, two-handed conflicts and ring behavior.
4. Unequip, reload, and check item ownership and character-bound equipment.

Serve with `python3 -m http.server 8000`, then open http://localhost:8000.
