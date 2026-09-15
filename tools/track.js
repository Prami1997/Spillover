// Does the map go exactly where the finger goes, and how late?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(500);
  await p.click('#btnNew'); await p.waitForTimeout(250);
  await p.evaluate(() => { startOutbreak(state, 'china'); setSpeed(0); dirty = true; });
  await p.waitForTimeout(400);

  for (const z of [1, 1.5, 2, 3]){
    const r = await p.evaluate(async (z) => {
      resetView();
      if (z > 1){ view.z = z; view.cx = fit.cx; view.cy = fit.cy; applyView(); }
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      const map = document.querySelector('#map'), rect = map.getBoundingClientRect();
      const send = (t, x, y) => map.dispatchEvent(new PointerEvent(t, {
        pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      const tx = () => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(document.querySelector('#world').getAttribute('transform')); return { x: +m[1], y: +m[2] }; };
      let x = rect.left + rect.width * 0.6, y = rect.top + rect.height * 0.45;
      send('pointerdown', x, y);
      const before = tx();
      const cxBefore = centreFor(fit.k * view.z).x;
      const stepPx = 12, steps = 5;   // small enough that the centre cannot move half a world
      for (let i = 0; i < steps; i++){
        x -= stepPx; y -= stepPx;
        send('pointermove', x, y);
        await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      }
      const cxAfter = centreFor(fit.k * view.z).x;
      const after = tx();
      send('pointerup', x, y);
      const f = rect.width / 400;
      // measure how far the world turned, not how the translate happens to read: the centre wraps
      const K = fit.k * view.z;
      let dcx = cxAfter - cxBefore;
      if (dcx > 200) dcx -= 400; if (dcx < -200) dcx += 400;
      return {
        fingerX: -stepPx * steps, fingerY: -stepPx * steps,
        mapX: +(-dcx * K * f).toFixed(1),
        mapY: +((after.y - before.y) / f).toFixed(1)
      };
    }, z);
    console.log(`zoom ${z}x: finger moved ${r.fingerX},${r.fingerY} px  ->  map moved ${r.mapX},${r.mapY} px` +
      `   (x ${(r.mapX / r.fingerX * 100).toFixed(0)}% of the finger, y ${(r.mapY / r.fingerY * 100).toFixed(0)}%)`);
  }

  // how many frames between the move arriving and the transform changing
  const lag = await p.evaluate(async () => {
    resetView();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const map = document.querySelector('#map'), rect = map.getBoundingClientRect();
    const send = (t, x, y) => map.dispatchEvent(new PointerEvent(t, {
      pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    const now = () => document.querySelector('#world').getAttribute('transform');
    let x = rect.left + rect.width * 0.6;
    const y = rect.top + rect.height * 0.45;
    send('pointerdown', x, y);
    send('pointermove', x - 20, y);              // past the slop
    const t0 = now();
    x -= 40; send('pointermove', x, y);
    const immediately = now() !== t0;
    await new Promise(r => requestAnimationFrame(r));
    const afterOneFrame = now() !== t0;
    send('pointerup', x, y);
    return { immediately, afterOneFrame };
  });
  console.log(`\nthe transform changes in the same event: ${lag.immediately}; after one frame: ${lag.afterOneFrame}`);
  await b.close();
})();
