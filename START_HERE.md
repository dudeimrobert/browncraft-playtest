# Browncraft Alpha 2.4.5

From the extracted project folder:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000/ to play. Keep using the same browser and port to retain local character saves. Internet access is required for the existing Three.js CDN imports.

Open http://localhost:8000/rig-test.html for the fitted skeleton, sword grip, skin weights and T-pose. Select **T-pose / alignment** from the animation menu. The **Original rig** link provides the previous weighting for comparison.

## Pootal progression

Approach the Pootal and click **Traverse the Brown**. A separate dialogue shows brown-gold realm icons and their lock status.

1. A’jol initially offers Weeping Fjarts.
2. Confront Mournwillow at the far end of Weeping Fjarts. Recover the **Fragment of Return** to awaken the local Pootal and unlock Assfall Steppes.
3. Defeat Vuldross in Assfall Steppes. The **Fragment of Pressure** awakens its return waypoint and unlocks Emberpood.
4. Defeat Cindergut in Emberpood. The **Fragment of Release** awakens Emberpood’s return waypoint.

Travel between outer realms goes through A’jol. Sigils are permanent inventory items. Realm-edge travel is disabled. Dormant Pootals show the requirement but do not allow returning before the sigil is claimed.

## Mournwillow combat

Mournwillow now uses **Bough Sweep**, a boss-specific 120-degree frontal attack. Its complete danger arc appears on the ground for 0.86 seconds before the strike. Dodge outside the arc, move behind Mournwillow, or block to reduce the hit. The sweep damages at most once and clears when the fight ends, the player dies, or the arena is left.

## Combat balance

The starting Knight now has 87 health, 70 stamina, and two Brown Flasks. Regular enemy health rises by realm (88 / 110 / 128), while Guardian health is 360 / 520 / 700. Dodges cost 22 stamina, heavy attacks cost 32, and base stamina recovery is 16 per second. Passive health recovery outside combat is intentionally slow, making damage and flask use persist between encounters.

A’jol now uses the supplied **Swamp Meadow Crossroads Tile** as its true ground texture. The collision mask remains separate, so this visual replacement does not alter traversal.

## Character assets

- `assets/models/frog-knight-repaired.glb`: optimized, rigid-segmented, natively skinned hero used by the game.
- The T-pose, untouched source model, and repair script are development assets and are intentionally excluded from this web-playtest package.
- The active Frog Knight GLB is under 25 MiB so every release file can be uploaded through GitHub's browser interface.

The sword remains a separate equipped asset. The hero GLB contains its skeleton and weights, but not runtime animation clips or the sword mesh.

See `ALPHA_2.4.5_NOTES.md` for tests and remaining limitations.
