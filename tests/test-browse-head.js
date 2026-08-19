/* The top of the Browse screen — the part between arriving and seeing a
   worker.

   It used to be six bands deep: a Back button alone on a 44px row, a
   locality row, a search box, a row of "POPULAR" trade chips, a row of
   category tiles, and a metadata row. 463 of 844 pixels — more than half a
   phone screen — before the first person you could actually book.

   Worse than the height was the ambiguity. A gold link reading "Search" sat
   immediately beside a box for searching services; it searched localities.
   Two rows of pill-shaped controls stacked on top of each other did
   unrelated jobs. Both scrolling rows ran off the right edge and stopped
   dead, so the categories past the fourth might as well not have existed.

   What this guards is that the chrome stays out of the way and that nothing
   removed to achieve it actually went missing. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css',
           '.woff2':'font/woff2','.webp':'image/webp'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8857);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce',
    geolocation: { latitude: 26.1445, longitude: 91.7362 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8857/'); await page.waitForTimeout(1800);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {};
    const n = document.getElementById('demoNote'); if (n) n.style.display = 'none';
    go('hire'); });
  await page.waitForTimeout(1500);

  // ---------- how much screen the chrome costs ----------
  const top = await page.evaluate(() => {
    const c = document.querySelector('.wcard');
    return c ? Math.round(c.getBoundingClientRect().top) : -1;
  });
  ok('A worker is on screen within the first half of it', top > 0 && top < 422,
     top + 'px of 844 before the first result');

  // ---------- Back is not a row of its own ----------
  ok('Back shares the locality row rather than owning one',
     await page.locator('.loc-bar .back-inline').count() === 1);
  ok('…and is still a proper thumb target',
     await page.locator('.loc-bar .back-inline').evaluate(e => {
       const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) >= 36; }));
  await page.locator('.loc-bar .back-inline').click(); await page.waitForTimeout(700);
  ok('…and still goes back', await page.evaluate(() => currentScreen) === 'home',
     await page.evaluate(() => currentScreen));
  await page.evaluate(() => go('hire')); await page.waitForTimeout(1200);

  // ---------- one search means one search ----------
  const locFind = await page.locator('#scr-hire .loc-find').first();
  ok('The locality search no longer says "Search" beside a service search box',
     (await locFind.innerText()).trim() === '', JSON.stringify((await locFind.innerText()).trim()));
  ok('…and says what it is to anybody having the page read out',
     (await locFind.getAttribute('aria-label')) === 'Search localities');
  ok('…and is no longer painted as the loudest thing on the screen',
     await locFind.evaluate(e => {
       const c = getComputedStyle(e).color;
       const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
       const hex = n => '#' + (n.match(/\d+/g)||[]).map(v => (+v).toString(16).padStart(2,'0')).join('');
       return hex(c).toLowerCase() !== brand.toLowerCase();
     }));

  // ---------- suggestions are suggestions ----------
  ok('The trade chips are not a permanent band',
     await page.locator('#suggests').isHidden());
  await page.locator('#hireSearch').focus(); await page.waitForTimeout(400);
  ok('…they appear when the box is focused', await page.locator('#suggests').isVisible());
  ok('…without the POPULAR label that ate a third of the row',
     !/POPULAR/i.test(await page.locator('#suggests').innerText()));
  const first = (await page.locator('#suggests .suggest').first().innerText()).trim();
  await page.locator('#suggests .suggest').first().click();
  await page.waitForTimeout(900);
  ok('…and tapping one still searches for it',
     (await page.inputValue('#hireSearch')) === first, first);
  ok('…and the row gets out of the way afterwards',
     await page.locator('#suggests').isHidden());

  // ---------- the rows say they continue ----------
  const fade = await page.evaluate(() => {
    const t = document.getElementById('tileGrid');
    const overflowing = t.scrollWidth - t.clientWidth > 4;
    const masked = getComputedStyle(t).webkitMaskImage !== 'none' || getComputedStyle(t).maskImage !== 'none';
    return { overflowing, masked, atEnd: t.classList.contains('at-end') };
  });
  ok('A category row with more to show fades at its edge',
     !fade.overflowing || fade.masked, JSON.stringify(fade));
  await page.evaluate(() => { const t = document.getElementById('tileGrid'); t.scrollLeft = t.scrollWidth; });
  await page.waitForTimeout(300);
  ok('…and stops fading once there is nothing more',
     await page.evaluate(() => document.getElementById('tileGrid').classList.contains('at-end')));

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
