# Browncraft Alpha 2.4.5 — Web Playtest

This folder is already a static browser build. It does not require a database,
application server, or build step. The host must serve this folder over HTTPS
with `index.html` at the published root.

## Fastest local test

From this folder, run:

```bash
python3 launch.py
```

Use the address printed in Terminal. Do not open `index.html` directly from the
filesystem because JavaScript modules and game assets require an HTTP server.

## Easiest shareable test

Upload the *contents* of this folder to a static web host. Confirm that
`index.html`, `app.js`, `styles.css`, and the `assets` folder are all at the
published root. No build command is required and the publish directory is `.`.

### GitHub Pages

1. Create a repository and add every file in this folder to its root.
2. In **Settings → Pages**, choose **Deploy from a branch**.
3. Select the main branch and `/ (root)`, then save.
4. Open the Pages URL after deployment completes.

### Netlify manual deploy

1. Open Netlify's manual deploy page.
2. Drag the extracted folder—not an enclosing parent folder—into the uploader.
3. Open the generated site URL when processing finishes.

## Playtest facts

- Internet access is required because Three.js and Google Fonts are loaded from
  external CDNs.
- Characters and progress are stored only in that browser's local storage.
  Clearing site data, changing browsers, or changing the site's domain removes
  access to that local save.
- The sign-in screen is cosmetic in this alpha. It does not authenticate or
  transmit credentials. Testers should use **Enter as guest** and should never
  enter a real password.
- The current package is large and may take time to load on slower connections.
- `character-lab.html` and `rig-test.html` are included as internal test pages.

## Acceptance check after publishing

1. Confirm the title reads `Alpha 2.4.5 · A’JOL CROSSROADS`.
2. Enter as guest, create a character, and enter A'jol.
3. Confirm the Frog Knight, terrain, music, and portal load without 404 errors.
4. Traverse to Weeping Fjarts and reload the page once to confirm the local save.
5. Test the published URL in a private/incognito window and on one mobile device.
