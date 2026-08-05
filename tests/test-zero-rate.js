/* MySheher sets no minimum rate. A worker who chooses to charge nothing —
   a student building a reputation, somebody helping a neighbour — must be
   able to publish that, and the app used to refuse it: `!x.price` is true
   of 0, so the box reading "0" was treated as the box left empty.

   Also checks the two things that must still be refused: an empty box, and
   a rate above the ceiling, which migration 37 deliberately kept. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css','.woff2':'font/woff2'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8829);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : '')); if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8829/'); await page.waitForTimeout(1200);

  /* put one service on the registration form and drive its rate box directly,
     which is what a worker's thumb does */
  const setRate = v => page.evaluate(val => {
    picked = ['Electrician'];
    renderPicked();
    const box = document.querySelector('.picked-card .sd-price');
    box.value = val;
    return collectSkills()[0];
  }, v);

  const zero = await setRate('0');
  ok('A rate of 0 is read as a rate that was set', zero.priced === true && zero.price === 0,
     JSON.stringify(zero));
  ok('…and the form lets it through',
     await page.evaluate(() => regWhyNot(1)) === null,
     String(await page.evaluate(() => regWhyNot(1))));

  const empty = await setRate('');
  ok('An empty box is still not a rate', empty.priced === false);
  ok('…and the form still stops there',
     /Add your rate/.test(String(await page.evaluate(() => regWhyNot(1)))));

  const spaces = await setRate('   ');
  ok('Nor is a box holding only spaces', spaces.priced === false);

  const words = await setRate('free');
  ok('Nor is a word', words.priced === false);

  const dec = await setRate('12.5');
  ok('Nor is a part-rupee amount', dec.priced === false);

  /* the ceiling is still the ceiling */
  await setRate('999999');
  const band = await page.evaluate(() => rateOutOfBand(collectSkills()));
  ok('The highest allowed rate is still enforced', /highest allowed/.test(String(band)), String(band));

  const one = await setRate('300');
  ok('An ordinary rate is unaffected',
     one.priced === true && one.price === 300 && await page.evaluate(() => regWhyNot(1)) === null);

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
