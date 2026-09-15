// Offline: turn the sea grid into one polyline per ordered pair of ports.
const fs = require('fs');
const G = JSON.parse(fs.readFileSync('grid.json', 'utf8'));
const { STEP, W, H, ports } = G;
const sea = Uint8Array.from(G.bits, c => c === '1' ? 1 : 0);
const N = W * H;
const idx = (i, j) => j * W + i;
// The map is flat but the ocean is not: the Pacific is split between the left and right edges,
// so column 0 and column W-1 are neighbours. Without this a ship from Japan to the USA sails
// around Africa and South America instead of straight across.
const WORLD = W * STEP;
const wrapI = i => (i + W) % W;
const dxWrap = (x1, x2) => { const d = Math.abs(x1 - x2); return Math.min(d, WORLD - d); };
const px = k => (k % W) * STEP + STEP / 2;
const py = k => ((k / W) | 0) * STEP + STEP / 2;

// distance to the nearest land cell, in cells
const clear = new Int16Array(N).fill(-1);
{
  const q = new Int32Array(N); let head = 0, tail = 0;
  for (let k = 0; k < N; k++) if (!sea[k]){ clear[k] = 0; q[tail++] = k; }
  while (head < tail){
    const k = q[head++], i = k % W, j = (k / W) | 0;
    if (i + 1 < W && clear[k + 1] < 0){ clear[k + 1] = clear[k] + 1; q[tail++] = k + 1; }
    if (i > 0 && clear[k - 1] < 0){ clear[k - 1] = clear[k] + 1; q[tail++] = k - 1; }
    if (j + 1 < H && clear[k + W] < 0){ clear[k + W] = clear[k] + 1; q[tail++] = k + W; }
    if (j > 0 && clear[k - W] < 0){ clear[k - W] = clear[k] + 1; q[tail++] = k - W; }
  }
}
const CLEAR_MIN = 2;      // cells of water under the keel to pass at all                       // cells of water a route must keep under the keel
// Only the one connected ocean counts. Nearest-water alone parks Canada in Hudson Bay and Japan
// in the Sea of Japan, and then nothing can sail anywhere.
const ocean = (() => {
  const comp = new Int32Array(N).fill(-1);
  const sizes = [];
  const q = new Int32Array(N);
  for (let start = 0; start < N; start++){
    if (!sea[start] || clear[start] < CLEAR_MIN || comp[start] >= 0) continue;
    const id = sizes.length; let head = 0, tail = 0, n = 0;
    comp[start] = id; q[tail++] = start;
    while (head < tail){
      const k = q[head++]; n++;
      const i = k % W, j = (k / W) | 0;
      for (let dj = -1; dj <= 1; dj++){ const nj = j + dj; if (nj < 0 || nj >= H) continue;
        for (let di = -1; di <= 1; di++){ const ni = i + di; if (ni < 0 || ni >= W) continue;
          const nk = idx(ni, nj);
          if (sea[nk] && clear[nk] >= CLEAR_MIN && comp[nk] < 0){ comp[nk] = id; q[tail++] = nk; } } }
    }
    sizes.push(n);
  }
  let big = 0; for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[big]) big = i;
  console.log(`water bodies: ${sizes.length}, largest holds ${sizes[big]} of ${sea.reduce((a, b) => a + b, 0)} sea cells`);
  return { comp, big };
})();
const ANCHOR_CLEAR = 4;   // a port sits in open water, not in a fjord
const ANCHOR_N = 4, ANCHOR_SEP = 14, ANCHOR_RANGE = 46;   // a port is just off its own coast
// One port per region is not enough: the USA's nearest water is the Atlantic, so every Pacific
// crossing was routed the long way round the world. Take up to four, far enough apart to land on
// genuinely different coasts, and let the search pick.
// Every region gets its own ports, near itself, and no two regions may share one: Canada and the
// USA otherwise both pick the same cell off Newfoundland and the lane between them is zero units
// long. Claiming by nearest-region instead leaves China and the Middle East with no port at all,
// because their own coastal water sits closer to a neighbour's marker.
function assignAnchors(){
  const taken = [];
  const out = {};
  const pool = ports.map(r => {
    const cand = [];
    for (let k = 0; k < N; k++){
      if (ocean.comp[k] !== ocean.big || clear[k] < ANCHOR_CLEAR) continue;
      const dx = dxWrap(px(k), r.x), dy = py(k) - r.y, d2 = dx * dx + dy * dy;
      if (d2 <= ANCHOR_RANGE * ANCHOR_RANGE) cand.push([d2, k]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    return { r, cand };
  });
  // the most hemmed-in regions choose first, or a landlocked-ish one is left with nothing
  pool.sort((a, b) => a.cand.length - b.cand.length);
  for (const { r, cand } of pool){
    const far = (k, list, sep) =>
      list.every(o => Math.hypot(dxWrap(px(k), px(o)), py(k) - py(o)) >= sep);
    const mine = [];
    for (const [, k] of cand){
      if (far(k, mine, ANCHOR_SEP) && far(k, taken, ANCHOR_SEP)) mine.push(k);
      if (mine.length >= ANCHOR_N) break;
    }
    // never leave a region landlocked: if the neighbours took everything, take the nearest cell
    // that at least is not literally one of theirs
    if (!mine.length) for (const [, k] of cand){ if (!taken.includes(k)){ mine.push(k); break; } }
    out[r.id] = mine;
    taken.push(...mine);
  }
  return out;
}

// A* over the sea grid. Plain arrays for the open list: with four ports seeded per region it
// outgrows any fixed guess.
const fq = [], kq = [];

// Many starts, many goals: seed every port of A and stop at whichever port of B is reached first,
// so one search picks the coast to leave from and the coast to arrive at.
function route(starts, goals){
  const g = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  let len = 0;
  fq.length = 0; kq.length = 0;
  const push = (f, k) => {
    let i = len++; fq[i] = f; kq[i] = k;
    while (i > 0){ const p = (i - 1) >> 1; if (fq[p] <= fq[i]) break;
      const tf = fq[p], tk = kq[p]; fq[p] = fq[i]; kq[p] = kq[i]; fq[i] = tf; kq[i] = tk; i = p; }
  };
  const pop = () => {
    const top = kq[0]; len--;
    fq[0] = fq[len]; kq[0] = kq[len];
    let i = 0;
    for (;;){ const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < len && fq[l] < fq[m]) m = l;
      if (r < len && fq[r] < fq[m]) m = r;
      if (m === i) break;
      const tf = fq[m], tk = kq[m]; fq[m] = fq[i]; kq[m] = kq[i]; fq[i] = tf; kq[i] = tk; i = m; }
    return top;
  };
  const goalSet = new Set(goals);
  const h = k => {
    let best = Infinity;
    for (const gk of goals) best = Math.min(best, Math.hypot(dxWrap(px(k), px(gk)), py(k) - py(gk)));
    return best;
  };
  for (const sk of starts){ g[sk] = 0; push(h(sk), sk); }
  let pops = 0, hit = -1;
  while (len){
    const k = pop();
    if (done[k]) continue;
    done[k] = 1; pops++;
    if (goalSet.has(k)){ hit = k; break; }
    const i = k % W, j = (k / W) | 0;
    for (let dj = -1; dj <= 1; dj++){
      const nj = j + dj; if (nj < 0 || nj >= H) continue;
      for (let di = -1; di <= 1; di++){
        if (!di && !dj) continue;
        const ni = wrapI(i + di);                       // off one edge and back on the other
        const nk = idx(ni, nj);
        if (!sea[nk] || done[nk] || clear[nk] < CLEAR_MIN) continue;
        // open water is cheaper than threading a strait
        const pen = clear[nk] < 4 ? 1.7 : clear[nk] < 7 ? 1.15 : 1;
        const ng = g[k] + (di && dj ? 1.4142 : 1) * STEP * pen;
        if (ng < g[nk]){ g[nk] = ng; prev[nk] = k; push(ng + h(nk), nk); }
      }
    }
  }
  if (hit < 0) return { path: null, pops };
  const cells = [];
  for (let k = hit; k !== -1; k = prev[k]) cells.push(k);
  cells.reverse();
  // Carry x straight through the seam instead of snapping back, so the line stays continuous and
  // the game can simply draw it a second time one world to the side.
  const path = [];
  let off = 0;
  for (let n = 0; n < cells.length; n++){
    const x = px(cells[n]);
    if (n){
      const prevX = px(cells[n - 1]);
      if (x - prevX > WORLD / 2) off -= WORLD;
      else if (prevX - x > WORLD / 2) off += WORLD;
    }
    path.push({ x: x + off, y: py(cells[n]) });
  }
  return { path, pops };
}
// Straightening needs more water than passing does: a sight line that only just clears the grid
// still cuts the corner off a headland, because the cell centre is at sea while the coast bulges.
const SIGHT_CLEAR = 3;    // more than that before a leg may be straightened
const sightOK = (a, b) => {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (STEP * 0.5));
  for (let i = 0; i <= n; i++){
    const t = i / n;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    const k = idx(wrapI(Math.round((x - STEP / 2) / STEP)),
                  Math.max(0, Math.min(H - 1, Math.round((y - STEP / 2) / STEP))));
    if (!sea[k] || clear[k] < SIGHT_CLEAR) return false;
  }
  return true;
};
function smooth(path){
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1){
    let j = i + 1;
    while (j + 1 < path.length && sightOK(path[i], path[j + 1])) j++;
    out.push(path[j]); i = j;
  }
  return out;
}

const t0 = Date.now();
const anchors = {};
Object.assign(anchors, assignAnchors());
console.log('anchors in', Date.now() - t0, 'ms;',
  ports.map(r => `${r.short}:${anchors[r.id].length}`).join(' '));
const missing = ports.filter(r => !anchors[r.id].length);
if (missing.length) console.log('NO ANCHOR for', missing.map(m => m.short).join(', '));

const t1 = Date.now();
const routes = {}; let worstPops = 0, failed = [];
for (let a = 0; a < ports.length; a++) for (let b2 = a + 1; b2 < ports.length; b2++){
  const A = ports[a], B = ports[b2];
  const { path, pops } = route(anchors[A.id], anchors[B.id]);
  worstPops = Math.max(worstPops, pops);
  if (!path){ failed.push(`${A.short} -> ${B.short}`); continue; }
  routes[A.id + '>' + B.id] = smooth(path).map(q => [Math.round(q.x), Math.round(q.y)]);
}
console.log(`${Object.keys(routes).length} routes in ${Date.now() - t1} ms, worst search popped ${worstPops} cells`);
if (failed.length) console.log('FAILED:', failed.join(' | '));
const pts = Object.values(routes).reduce((s, r) => s + r.length, 0);
console.log('total points:', pts, ' avg per route:', (pts / Object.keys(routes).length).toFixed(1));
fs.writeFileSync('routes.json', JSON.stringify({
  anchors: Object.fromEntries(ports.map(r => [r.id, anchors[r.id].map(k => [Math.round(px(k)), Math.round(py(k))])])),
  routes }));
console.log('longest:', Object.entries(routes).sort((x, y) => y[1].length - x[1].length).slice(0, 5).map(([k, v]) => `${k} (${v.length})`).join(', '));
