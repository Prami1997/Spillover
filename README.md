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

### Sea lanes
Ships used to be drawn as a plain arc from one region to the next, which meant they sailed over
Asia: the region markers sit inland, so all 190 port pairs crossed land, most of them for more
than a quarter of the trip. `SEA_LANES` in `index.html` holds a real route for every pair instead,
worked out once against this very coastline — a 2-unit sea grid taken from the land path, A* that
keeps four units of water under the keel and prefers open ocean to a strait, then straightened
only where there is room. Every lane is checked along the line the game actually draws: none of
them touches land. Planes and carriers still fly a bow straight over whatever is in the way,
because they fly.

Two things the routing needs that are easy to miss. **Each region has several ports, not one**:
the water nearest the United States is the Atlantic, so with a single port every Pacific crossing
went the long way round the world. Up to four are placed off each region's own coast, far enough
apart to be genuinely different coasts and never shared with a neighbour, and one search starts
from all of a region's ports at once and stops at whichever port of the destination it reaches
first. **And the ocean wraps**: the map is flat, so the Pacific is split between the left and
right edges. Column 0 and the last column are neighbours in the grid, a lane that crosses the seam
keeps counting past 0 or 400 instead of jumping, and `launch()` draws such a lane a second time
one world over so the ship leaves one edge and arrives at the other. Japan to the USA is 104 units
across the Pacific; before the wrap it was 327 around Africa and South America.

If the map ever moves, regenerate the table with the scripts in `tools/` — see `tools/README.md`.

### Zooming the map
The world is far wider than it is tall, so on a phone the default view is already edge to edge and
every pixel left over is vertical - the only way to make a region bigger is to show less of the
world. So the map pinches, drags and takes the mouse wheel, up to 3.2x; `+`, `-` and `0` do the same from
a keyboard, and a control appears in the corner once you are zoomed. A drag pans instead of
selecting whatever it passed over, and a pinch that starts on a DNA bubble does not spend it.
Region names grow with the zoom only up to `LBL_CAP`, past which they hold their size rather than
covering the legend, and the HUD gets a scrim to stand on once land slides underneath it. The
default view is untouched: same transform, same pixels.

Panning writes the transform in the same event it hears about the finger, and the map's own box is
cached rather than re-read: asking for geometry right after writing a transform forces the browser
to lay the page out there and then, which measured 0.366 ms a move against 0.033 with the box kept.
That path had existed since zoom shipped but hardly ever ran, because panning used to do nothing at
the default view — the moment it did something, every drag hit it.

**East and west do not end.** The world is a cylinder, so dragging sideways keeps going and comes
round again — you can centre the view on the Pacific, which the old clamped map could not show at
all. Two `<use>` copies of the map sit one world either side to fill the edges, drawn only while an
edge is actually in shot, so the default view costs exactly what it did before. They take no
pointer events of their own: a tap that lands on a copy falls through to the map and is resolved
back to the region or bubble it is a picture of. Up and down still stop at the last of the sea,
because there is nothing above or below to repeat.

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
