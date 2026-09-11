# Spillover

Personal hobby clone of a pathogen strategy game. Single-page app, no backend.

## Files
- `index.html` – the whole game (config, simulation and UI)
  - the simulation (`createState` / `tick` / `evolve` / …) is in its own `<script id="sim">` block and touches no DOM
  - the map, HUD and panels are in the second script block
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

## Playing
The world map fills the screen; day, DNA, the pathogen stats and cure progress float over the
ocean. The panel underneath has three tabs — the selected region, every region plus a chart, and
the event log — and its handle drags up for more room. Speed controls sit along the bottom, and
the gear opens settings (new game, step a day, and the debug restart and bonus-stat sliders).

Sound is synthesised in the browser — there are no audio files in the repo and nothing extra for
the service worker to cache. The speaker button next to the gear mutes it, and the choice is
remembered. Cues are driven off the event log, so anything the simulation reports can make a
noise without the simulation knowing sound exists. `SFX` at the top of the sound section holds the
levels and the minimum spacing between repeats; those gaps stretch automatically at 5× and above,
because a sped-up world reports more than an ear can follow.

**The clock only runs while you are looking at the map.** Opening the evolve sheet or settings
pauses the game and closing it gives you your speed back, so reading a trait never costs you days.

## Saves
Saved in the browser storage of the phone. Clearing Chrome's site data for the page deletes the save.
