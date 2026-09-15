# tools

Only needed if the map itself changes. They are not part of the game and nothing in `index.html`
loads them; they need Node and Playwright (`NODE_PATH` pointing at an install of it), and a Chromium via `CHROME=`.

Run them in this order, from this folder:

1. `node dumpgrid.js` — opens the game, asks the rendered coastline which 2-unit cells are sea,
   and writes `grid.json`.
2. `node buildroutes.js` — routes every pair of port regions across that grid and writes
   `routes.json`. Prints the point count; paste the compact form into `SEA_LANES`.
3. `node checkroutes.js` — samples every lane against the real coastline and reports anything
   touching land, then draws all of them over the map as `searoutes.png` for a look.

## Panning

`track.js` reports how far the map moves for a given finger movement, and whether the transform
changes in the same event or a frame later. `panperf.js` times a move and, importantly, times a
write followed by a read — reading geometry straight after writing a transform makes the browser
lay the page out on the spot, which is what once turned a 0.075 ms move into 0.366.
