/* The browse screen: one category control, a visible way to undo a filter,
   and no offer of the screen you are already on. */
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
}).listen(8820);

const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce',
    geolocation: { latitude: 26.1445, longitude: 91.7362 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8820/'); await page.waitForTimeout(1300);

  await page.evaluate(() => go('hire')); await page.waitForTimeout(1300);

  // ---------- one category control ----------
  ok('The second row of category chips is gone',
     await page.locator('.cat-row, .cat-chip').count() === 0);
  const tiles = await page.locator('#tileGrid .tile:not(.more)').count();
  ok('Eight categories to start with', tiles === 8, tiles);
  ok('A fold offers the rest', await page.locator('#tileGrid .tile.more').count() === 1,
     (await page.locator('#tileGrid .tile.more b').innerText()).trim());

  const total = await page.evaluate(() => CATALOGUE.length);
  await page.locator('#tileGrid .tile.more').click(); await page.waitForTimeout(400);
  const opened = await page.locator('#tileGrid .tile:not(.more)').count();
  ok('Opening it reaches every category', opened === total, `${opened} of ${total}`);
  ok('Categories with no tile before are reachable now', await page.evaluate(() => {
    const want = ['prof','edit','garden','pet','tailor','facility'];
    const labels = [...document.querySelectorAll('#tileGrid .tile')].map(t => t.getAttribute('aria-label'));
    return want.every(k => labels.includes((CAT_LABEL[k])));
  }));
  await page.locator('#tileGrid .tile.more').click(); await page.waitForTimeout(400);
  ok('And it folds back', await page.locator('#tileGrid .tile:not(.more)').count() === 8);

  // ---------- the active filter is visible and undoable ----------
  ok('Nothing shown when nothing is filtered', await page.locator('.fpill').count() === 0);
  await page.locator('#tileGrid .tile').first().click(); await page.waitForTimeout(800);
  ok('Choosing a category shows a removable pill', await page.locator('.fpill').count() === 1,
     (await page.locator('.fpill').first().innerText()).trim());
  ok('The chosen tile reads as pressed',
     await page.locator('#tileGrid .tile[aria-pressed="true"]').count() === 1);
  ok('A selected category stays on screen while the rest are folded',
     await page.locator('#tileGrid .tile.on').count() === 1);
  await page.locator('.fpill').first().click(); await page.waitForTimeout(800);
  ok('The pill clears the filter', await page.locator('.fpill').count() === 0 &&
     await page.evaluate(() => hireCat === ''));

  // several at once, and one way to drop them all
  await page.locator('#tileGrid .tile').first().click(); await page.waitForTimeout(600);
  await page.selectOption('#areaFilter', 'Six Mile'); await page.waitForTimeout(700);
  await page.fill('#hireSearch', 'cleaning'); await page.waitForTimeout(800);
  const pills = await page.locator('.fpill').count();
  ok('Every active filter is listed', pills === 4, pills + ' (3 filters + clear all)');
  ok('Clear all is offered', await page.locator('.fpill.clear-all').count() === 1);
  await page.locator('.fpill.clear-all').click(); await page.waitForTimeout(900);
  ok('Clear all really clears everything', await page.evaluate(() =>
     hireCat === '' && document.getElementById('areaFilter').value === '' &&
     document.getElementById('hireSearch').value === ''));
  ok('And the full list comes back', await page.locator('.wcard').count() > 0,
     await page.locator('.wcard').count() + ' workers');

  // ---------- the header ----------
  ok('No "Browse professionals" link while browsing', await page.locator('#browseLink').isVisible() === false);
  await page.evaluate(() => go('home')); await page.waitForTimeout(500);
  ok('It comes back on other screens', await page.locator('#browseLink').isVisible());

  // ---------- the promise matches what the app does ----------
  await page.evaluate(() => go('hire')); await page.waitForTimeout(900);
  /* The three-column trust strip became the one-line .assure row. What the
     assertion is really for is that the screen no longer promises WhatsApp is
     the only way a booking travels, since it is not — so check the promise,
     not the element that used to carry it. */
  const trust = await page.locator('.hire-assure').innerText();
  ok('The screen no longer claims WhatsApp is the only route',
     /inside the app/i.test(trust) && !/straight to the worker on WhatsApp/i.test(trust),
     trust.replace(/\n/g, ' / '));

  // ---------- still shorter than it was ----------
  const h = await page.evaluate(() => document.getElementById('scr-hire').scrollHeight);
  ok('Screen fits in fewer screenfuls', h < 3300, Math.round(h / 844 * 10) / 10 + ' screens');
  ok('No horizontal overflow', await page.evaluate(() =>
     document.documentElement.scrollWidth <= window.innerWidth + 1));

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
