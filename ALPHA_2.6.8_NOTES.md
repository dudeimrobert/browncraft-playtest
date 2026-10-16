# Browncraft Alpha 2.6.8

- Removed the player-facing Item Catalog menu and dialog. The separate Item Tracker workbook is internal and is not included in the game.
- All unfinished player frog types now use the imported, animated Tree Frog. Swamp Toad retains its distinct imported model. Creator, equipment preview and gameplay share this mapping; no procedural player fallback is generated.
- Removed the legacy procedural Character Lab from the release.
- Swamp Toad now prefers its native animation clips, with transferred Tree clips available as fallbacks. Animated lower-leg support is aligned with the ground; idle and movement no longer add a separate root bob. Authored jump lift is preserved.
- Ground support uses convex hull samples grouped by identical skin weights to reduce animation cost while retaining the exact support extrema.

Validation: npm test passes catalog, inventory, species mapping, actual GLB animation and independent full-body ground-contact checks. Both actual posed meshes were reviewed from front and side offline. A hosted browser playtest has not been performed for this release.

Item behavior is unchanged from 2.6.7: 114 catalog entries, 88 eligible for ordinary enemy drops, 24 boss-only entries and 2 registered entries without an acquisition route. Individual item playtests remain unchecked. Special item effects, consumable actions, set bonuses and dedicated item models remain unfinished. Tracker icons are the current category glyphs, not final item artwork.

Publish using the accompanying publish_browncraft_2.6.8.sh script. This archive does not itself update the hosted game.
