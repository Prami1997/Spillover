// What does one finger-move actually cost? Throttled to stand in for a phone.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(700);
  await p.click('#btnNew'); await p.waitForTimeout(250);
  await p.evaluate(() => { startOutbreak(state, 'china'); for (let i = 0; i < 120; i++) tick(state); setSpeed(0); dirty = true; });
  await p.waitForTimeout(500);

  const r = await p.evaluate(() => {
    const out = {};
    const time = (label, fn, n) => {
      fn(); // warm
      const t0 = performance.now();
      for (let i = 0; i < n; i++) fn();
      out[label] = +((performance.now() - t0) / n).toFixed(3);
    };
    time('applyView', () => { view.cx = (view.cx || 200) + 0.7; applyView(); }, 200);
    time('centreFor', () => centreFor(fit.k * view.z), 200);
    time('toView (reads the map rect)', () => toView(200, 400), 200);
    // the pattern a drag actually produces: write a transform, then read geometry back
    time('write then read', () => { view.cx += 0.7; applyView(); toView(200, 400); }, 200);
    // and what the same loop costs once the rect is not re-read
    const cached = document.querySelector('#map').getBoundingClientRect();
    time('write then cached read', () => {
      view.cx += 0.7; applyView();
      const q = { x: (200 - cached.left) / cached.width * 400, y: (400 - cached.top) / cached.width * 400 };
      return q;
    }, 200);
    // how much of applyView is the label variable
    time('just the label var', () => {
      document.querySelector('#map').style.setProperty('--lblk', (0.9 + Math.random() * 0.01).toFixed(3));
    }, 200);
    return out;
  });
  for (const k of Object.keys(r)) console.log(`   ${k.padEnd(30)} ${String(r[k]).padStart(7)} ms per call`);

  // and the frame rate while a finger is actually dragging
  const drag = await p.evaluate(() => new Promise(res => {
    const map = document.querySelector('#map');
    const rect = map.getBoundingClientRect();
    const send = (type, x, y, id) => map.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    const frames = []; let last = performance.now(), n = 0, x = rect.left + rect.width * 0.7;
    const y = rect.top + rect.height * 0.5;
    send('pointerdown', x, y, 1);
    const step = () => {
      const now = performance.now(); frames.push(now - last); last = now;
      // a real finger produces two or three moves per frame on a 120Hz panel
      for (let i = 0; i < 3; i++){ x -= 1.6; send('pointermove', x, y, 1); }
      if (++n < 70) requestAnimationFrame(step);
      else { send('pointerup', x, y, 1); frames.sort((a, b) => a - b);
             res({ median: +frames[35].toFixed(1), p90: +frames[63].toFixed(1), worst: +frames[69].toFixed(1) }); }
    };
    requestAnimationFrame(step);
  }));
  console.log(`\n   while dragging: median frame ${drag.median} ms, 90th ${drag.p90} ms, worst ${drag.worst} ms`);
  await b.close();
})();
