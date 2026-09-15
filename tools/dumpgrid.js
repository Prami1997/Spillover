// Pull the sea/land grid out of the real coastline once, so the routing can be done in Node.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 500, height: 700 } })).newPage();
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(400);
  await p.click('#btnNew'); await p.waitForTimeout(200);
  const d = await p.evaluate(() => {
    const STEP = 2, W = Math.ceil(400 / STEP), H = Math.ceil(312 / STEP);
    const land = document.querySelector('#landFill');
    let s = '';
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++)
      s += land.isPointInFill(new DOMPoint(i * STEP + STEP / 2, j * STEP + STEP / 2)) ? '0' : '1';
    return { STEP, W, H, bits: s,
      ports: state.regions.filter(r => r.port > 0).map(r => ({ id: r.id, short: r.short, x: r.x, y: r.y })) };
  });
  fs.writeFileSync('grid.json', JSON.stringify(d));
  console.log(`grid ${d.W}x${d.H} at ${d.STEP} units, ${d.ports.length} port regions, ${d.bits.length} cells`);
  await b.close();
})();
