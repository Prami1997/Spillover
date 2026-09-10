# Spillover

Personal hobby clone of a pathogen strategy game. Single-page app, no backend.

## Files
- `index.html` – the whole game (config, simulation and UI)
- `manifest.webmanifest`, `icon-*.png` – makes it installable
- `sw.js` – offline support

## Hosting on GitHub Pages
1. New repository `spillover`, public, upload all files to the root.
2. Settings → Pages → Build and deployment → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`, Save.
3. After a minute or two it's live at `https://<username>.github.io/spillover/`.
4. Open that in Chrome on Android → menu (⋮) → *Add to home screen* / *Install app*.

## Updating
Upload the new `index.html` over the old one and commit. The installed app picks up the
new version on the second launch after the upload (the first launch still serves the cached copy).

## Saves
Saved in the browser storage of the phone. Clearing Chrome's site data for the page deletes the save.
