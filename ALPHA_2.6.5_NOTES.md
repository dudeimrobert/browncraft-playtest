# Browncraft Alpha 2.6.5 — Corpse Looting and Croaks

- Click defeated enemy remains within 7 world units to open a modal loot window.
- Single-item Take and Loot All actions move rewards into per-character localStorage.
- Corpses remain visible after death until fully looted; an emptied corpse disappears.
- Enemy drops are rolled once per death. The window can be reopened without rerolling.
- Inventory shows scavenged materials and a three-column gold/silver/copper Croaks wallet.
- Croaks have base denominations 1 copper, 10 silver, 100 gold; normalized from a single integer.
- Corpse contents are transient for the current realm session; collected currency/materials persist locally.

## Test instructions
Start using launch.py, defeat a non-boss enemy in Weeping Fjarts, approach its fallen body, click, take an item, close/reopen, Loot All, and verify currency via B in the bag.

## Current limitations
- Item drops use a small placeholder pool of 4 materials, not the full item database.
- No live browser runtime smoke-test was performed; verify interaction in the game.
- No dedicated corpse model or hover highlight yet.
- Corpse contents not saved through realm reload; only collected items and wallet persist.
