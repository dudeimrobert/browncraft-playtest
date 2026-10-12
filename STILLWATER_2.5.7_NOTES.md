# Browncraft Alpha 2.5.7 — Stillwater Static Water Patch

Based on Alpha 2.5.6. Only modifies `assets/world3d.js` and adds this note.

- Stillwater Basin renders a single translucent still water plane (2 triangles, no water displacement).
- Fixed brown-green tint and 0.48 opacity; basic material, no reflection/refraction or dynamic light evaluation.
- No per-frame vertex buffer updates or opacity pulsing in Stillwater.
- All other realms retain their existing animated water.
- Gullet, pier/ramp, Pootal, map texture, willows, and realm menu remain unchanged.

## Test
1. Clear cache/hard refresh Netlify after GitHub deployment.
2. Travel via A'jol Pootal into Bayou Bazaar and inspect stationary water.
3. Walk onto The Gullet via the pier, return through the Pootal.
4. Enter Weeping Fjarts to verify its original animated water still works.

Note: this is a lightweight planar visual overlay, not a shoreline-clipped water polygon. The land is above the water plane.
