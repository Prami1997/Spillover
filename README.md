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
Upload the new `index.html` over the old one and commit. The installed app picks it up on the
next launch: `sw.js` fetches the page network-first, so a deploy is live immediately and the
cache is only used when there is no network.

If you ever do see a stale copy, it is the browser still holding the old service worker — open
the page twice, or clear the site's data once.

## Playing
The world map fills the screen; day, DNA, the pathogen stats and cure progress float over the
ocean. The panel underneath has three tabs — the selected region, every region plus a chart, and
the event log — and its handle drags up for more room. Speed controls sit along the bottom, and
the gear opens settings (new game, step a day, and the debug restart and bonus-stat sliders).

Sound and music are both synthesised in the browser — there are no audio files in the repo and
nothing extra for the service worker to cache. The music is a slow drone and a four-chord pad that
listens to the run: as the world notices you and the cure closes in, the filter opens, a dissonant
voice creeps in against the bass and a heartbeat starts under it. It fades out when the game ends
so the closing sound has room. `MUSIC` holds the chords and the tuning; settings has a toggle for
it on its own. The speaker button next to the gear mutes it, and the choice is
remembered. Cues are driven off the event log, so anything the simulation reports can make a
noise without the simulation knowing sound exists. `SFX` at the top of the sound section holds the
levels and the minimum spacing between repeats; those gaps stretch automatically at 5× and above,
because a sped-up world reports more than an ear can follow.

**The clock only runs while you are looking at the map.** Opening the evolve sheet or settings
pauses the game and closing it gives you your speed back, so reading a trait never costs you days.

### The genome only holds so many traits
The pathogen carries a limited number of traits at once, so evolving is a choice rather than a
collection: once the genome is full, buying something new means dropping something you own. Any
trait can be dropped as long as what is left still connects to a root of its tree, and half of its
price comes back as DNA. The genome grows as the disease reaches more of the world and as more of
the world dies — `genomeBase`, `genomePerRegions` and `genomeDeathSlots` in `CONFIG.sim` set the
shape of it. Hoarding every cheap symptom early now loses the run outright.

### A second front
Waiting for a plane to do the work is the dull half of the game, so you can put a carrier on a
route yourself. Tap a region the disease has not reached and the region panel offers to send one:
it costs DNA, the price rises with the distance from the nearest outbreak, with every front you
have already opened, and steeply if that region has already shut its airports, ports and borders.
The carrier flies across the map and the region is infected the same day. `frontBase`,
`frontDistK`, `frontStep` and `frontSealedK` in `CONFIG.sim` tune it.

## Saves
Saved in the browser storage of the phone. Clearing Chrome's site data for the page deletes the save.
