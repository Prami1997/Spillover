const { chromium } = require('playwright');
const fs = require('fs');
const R = JSON.parse(fs.readFileSync('routes.json', 'utf8'));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(400);
  await p.click('#btnNew'); await p.waitForTimeout(200);
  const res = await p.evaluate(R => {
    const land = document.querySelector('#landFill');
    let worst = 0, bad = [], total = 0, onLand = 0;
    for (const [key, path] of Object.entries(R.routes)){
      let hits = 0, n = 0;
      for (let i = 0; i < path.length - 1; i++){
        const [x0, y0] = path[i], [x1, y1] = path[i + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.5));
        for (let s = 0; s <= steps; s++){
          const t = s / steps; n++; total++;
          if (land.isPointInFill(new DOMPoint(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))){ hits++; onLand++; }
        }
      }
      const pct = hits / n * 100;
      if (pct > worst) worst = pct;
      if (pct > 0) bad.push({ key, pct: +pct.toFixed(1) });
    }
    // and are the anchors themselves at sea?
    const dryAnchors = Object.entries(R.anchors).filter(([, [x, y]]) => land.isPointInFill(new DOMPoint(x, y))).map(([k]) => k);
    return { routes: Object.keys(R.routes).length, worst: +worst.toFixed(1), bad: bad.slice(0, 8),
             badCount: bad.length, total, onLand, dryAnchors };
  }, R);
  console.log(`checked ${res.routes} routes against the real coastline: ${res.total} samples, ${res.onLand} on land`);
  console.log(`routes touching land at all: ${res.badCount}, worst ${res.worst}%`);
  if (res.bad.length) console.log('  ', res.bad.map(x => `${x.key} ${x.pct}%`).join('  '));
  console.log('anchors on dry land:', res.dryAnchors.length ? res.dryAnchors.join(', ') : 'none');

  // draw every route over the map for a look
  await p.evaluate(R => {
    const g = document.querySelector('#world');
    const ns = 'http://www.w3.org/2000/svg';
    for (const path of Object.values(R.routes)){
      const e = document.createElementNS(ns, 'polyline');
      e.setAttribute('points', path.map(q => q.join(',')).join(' '));
      e.setAttribute('fill', 'none'); e.setAttribute('stroke', '#7C93A0');
      e.setAttribute('stroke-opacity', '.55'); e.setAttribute('stroke-width', '.6');
      g.appendChild(e);
    }
    for (const [, [x, y]] of Object.entries(R.anchors)){
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '1.6');
      c.setAttribute('fill', '#A4884A'); g.appendChild(c);
    }
  }, R);
  await p.waitForTimeout(400);
  await p.locator('.stage').screenshot({ path: 'searoutes.png' });
  await b.close();
})();
