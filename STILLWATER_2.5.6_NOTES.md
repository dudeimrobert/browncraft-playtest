# Browncraft Alpha 2.5.6 — Stillwater Basin first playable blockout

- Adds Bayou Bazaar to **Traverse the Brown** at A’jol with no Guardian gating. Travel to other adventure realms still follows their original progression; return through A’jol.
- Includes approved Stillwater swamp ground artwork (without tree models), plus a separately generated, approximate classification mask.
- Places fifteen reused optimized willow trees at curated positions derived from the approved aerial concept.
- Builds an accessible procedural wood pier, boardable temporary Gullet pontoon/deck/canopy, and physical ramp connection to the deck.
- The Gullet is a **placeholder blockout**, not the approved architectural design or a finished model. Ol’ Mudd, commerce/auction multiplayer and the final vessel model are not implemented.
- The custom collision footprint for the dock and deck is not yet a general-purpose navigation mesh. Fine-tuning shoreline and pier alignment should follow a playtest.
- Ground mask is automatically approximated from artwork; edge collision should be tested rather than assumed exact.
- Existing save prefix is untouched.

Start with `python3 -m http.server 8000` in this folder and open http://localhost:8000.
