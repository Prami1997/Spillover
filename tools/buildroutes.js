// Offline: turn the sea grid into one polyline per ordered pair of ports.
const fs = require('fs');
const G = JSON.parse(fs.readFileSync('grid.json', 'utf8'));
const { STEP, W, H, ports } = G;
const sea = Uint8Array.from(G.bits, c => c === '1' ? 1 : 0);
const N = W * H;
const idx = (i, j) => j * W + i;
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
function anchor(r){
  let best = -1, bd = Infinity;
  for (let k = 0; k < N; k++){
    if (ocean.comp[k] !== ocean.big || clear[k] < ANCHOR_CLEAR) continue;
    const d = (px(k) - r.x) ** 2 + (py(k) - r.y) ** 2;
    if (d < bd){ bd = d; best = k; }
  }
  return best;
}
// A* with a flat binary heap over typed arrays
const fq = new Float64Array(N * 4), kq = new Int32Array(N * 4);
function route(sk, gk){
  const g = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  let len = 0;
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
  const gx = px(gk), gy = py(gk);
  g[sk] = 0; push(Math.hypot(px(sk) - gx, py(sk) - gy), sk);
  let pops = 0;
  while (len){
    const k = pop();
    if (done[k]) continue;
    done[k] = 1; pops++;
    if (k === gk) break;
    const i = k % W, j = (k / W) | 0;
    for (let dj = -1; dj <= 1; dj++){
      const nj = j + dj; if (nj < 0 || nj >= H) continue;
      for (let di = -1; di <= 1; di++){
        if (!di && !dj) continue;
        const ni = i + di; if (ni < 0 || ni >= W) continue;
        const nk = idx(ni, nj);
        if (!sea[nk] || done[nk] || clear[nk] < CLEAR_MIN) continue;
        // open water is cheaper than threading a strait
        const pen = clear[nk] < 4 ? 1.7 : clear[nk] < 7 ? 1.15 : 1;
        const ng = g[k] + (di && dj ? 1.4142 : 1) * STEP * pen;
        if (ng < g[nk]){ g[nk] = ng; prev[nk] = k; push(ng + Math.hypot(px(nk) - gx, py(nk) - gy), nk); }
      }
    }
  }
  if (gk !== sk && prev[gk] < 0) return { path: null, pops };
  const out = [];
  for (let k = gk; k !== -1; k = prev[k]){ out.push(k); if (k === sk) break; }
  return { path: out.reverse(), pops };
}
// Straightening needs more water than passing does: a sight line that only just clears the grid
// still cuts the corner off a headland, because the cell centre is at sea while the coast bulges.
const SIGHT_CLEAR = 3;    // more than that before a leg may be straightened
const sightOK = (a, b) => {
  const n = Math.ceil(Math.hypot(px(b) - px(a), py(b) - py(a)) / (STEP * 0.5));
  for (let i = 0; i <= n; i++){
    const t = i / n;
    const x = px(a) + (px(b) - px(a)) * t, y = py(a) + (py(b) - py(a)) * t;
    const k = idx(Math.max(0, Math.min(W - 1, Math.round((x - STEP / 2) / STEP))),
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
for (const r of ports) anchors[r.id] = anchor(r);
console.log('anchors in', Date.now() - t0, 'ms');
const missing = ports.filter(r => anchors[r.id] < 0);
if (missing.length) console.log('NO ANCHOR for', missing.map(m => m.short).join(', '));

const t1 = Date.now();
const routes = {}; let worstPops = 0, failed = [];
for (let a = 0; a < ports.length; a++) for (let b2 = a + 1; b2 < ports.length; b2++){
  const A = ports[a], B = ports[b2];
  const { path, pops } = route(anchors[A.id], anchors[B.id]);
  worstPops = Math.max(worstPops, pops);
  if (!path){ failed.push(`${A.short} -> ${B.short}`); continue; }
  routes[A.id + '>' + B.id] = smooth(path).map(k => [Math.round(px(k)), Math.round(py(k))]);
}
console.log(`${Object.keys(routes).length} routes in ${Date.now() - t1} ms, worst search popped ${worstPops} cells`);
if (failed.length) console.log('FAILED:', failed.join(' | '));
const pts = Object.values(routes).reduce((s, r) => s + r.length, 0);
console.log('total points:', pts, ' avg per route:', (pts / Object.keys(routes).length).toFixed(1));
fs.writeFileSync('routes.json', JSON.stringify({ anchors: Object.fromEntries(ports.map(r => [r.id, [Math.round(px(anchors[r.id])), Math.round(py(anchors[r.id]))]])), routes }));
console.log('longest:', Object.entries(routes).sort((x, y) => y[1].length - x[1].length).slice(0, 5).map(([k, v]) => `${k} (${v.length})`).join(', '));
