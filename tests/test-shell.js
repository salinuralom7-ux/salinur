/* The app shell.

   The bug this locks down: a `position:fixed` tab bar pinned with `bottom:0`
   drifts on a phone. `bottom` is measured against the LAYOUT viewport, which
   on iOS is taller than the part you can see while the browser's toolbar is
   up, and which on Android changes height mid-flick as the toolbar collapses.
   The bar ends up floating across the middle of the page, sitting on top of
   whatever is there — search results, the footer's social buttons. It was
   reported on the home screen, patched with JavaScript measurement, and then
   reported again on the browse screen, which is how you know the patch was
   the wrong shape of fix.

   So the bar is not fixed any more. The body is exactly one viewport tall and
   does not scroll; it is a column of three rows — header, a scrolling middle,
   the bar. A last child cannot drift off the bottom of its parent. These
   assertions are about that structure, on every screen and every size,
   because the structure is the fix. */
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
}).listen(8843);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

const SIZES = [
  { w: 390, h: 844, n: 'iPhone' },
  { w: 360, h: 640, n: 'small Android' },
  { w: 844, h: 390, n: 'landscape' },
  { w: 1280, h: 900, n: 'desktop' },
];
/* Every screen that carries the bar. The chat screen is deliberately not
   here: it is a full surface of its own and hides the bar. */
const SCREENS = ['home', 'hire', 'work', 'chats', 'account', 'verify'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  // ---------- the structure, at four sizes ----------
  for (const s of SIZES) {
    const ctx = await b.newContext({ viewport: { width: s.w, height: s.h }, reducedMotion: 'reduce',
      geolocation: { latitude: 26.1445, longitude: 91.7362 }, permissions: ['geolocation'] });
    const page = await ctx.newPage();
    await page.goto('http://localhost:8843/'); await page.waitForTimeout(2000);
    const m = await page.evaluate(() => {
      const bar = document.getElementById('tabbar');
      const r = bar.getBoundingClientRect();
      const sc = document.getElementById('scroll');
      return {
        barBottom: Math.round(r.bottom), win: window.innerHeight,
        barPosition: getComputedStyle(bar).position,
        bodyH: Math.round(document.body.getBoundingClientRect().height),
        docScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
        middleScrolls: sc.scrollHeight > sc.clientHeight + 1,
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    ok(`[${s.n}] body is exactly one viewport tall`, Math.abs(m.bodyH - m.win) <= 1, `${m.bodyH} of ${m.win}`);
    ok(`[${s.n}] the document itself does not scroll`, !m.docScrolls);
    ok(`[${s.n}] the bar is in normal flow`, m.barPosition === 'relative', m.barPosition);
    ok(`[${s.n}] the bar ends at the bottom of the screen`, Math.abs(m.barBottom - m.win) <= 1,
       `${m.barBottom} of ${m.win}`);
    ok(`[${s.n}] nothing overflows sideways`, !m.sideways);
    await ctx.close();
  }

  // ---------- scroll each screen to its end; the bar must not move ----------
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce',
    geolocation: { latitude: 26.1445, longitude: 91.7362 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8843/'); await page.waitForTimeout(2000);

  for (const name of SCREENS) {
    await page.evaluate(n => go(n), name); await page.waitForTimeout(700);
    const before = await page.evaluate(() => Math.round(document.getElementById('tabbar').getBoundingClientRect().bottom));
    await page.evaluate(() => { const s = document.getElementById('scroll'); s.scrollTop = s.scrollHeight; });
    await page.waitForTimeout(450);
    const after = await page.evaluate(() => {
      const bar = document.getElementById('tabbar').getBoundingClientRect();
      const sc = document.getElementById('scroll');
      /* everything the customer could want to touch at the foot of the page */
      const hidden = [...document.querySelectorAll('footer a, .screen.on a, .screen.on button')]
        .filter(el => { const r = el.getBoundingClientRect();
                        return r.height > 0 && r.bottom > bar.top + 1 && r.top < bar.bottom - 1; })
        .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18));
      return { bottom: Math.round(bar.bottom), win: window.innerHeight,
               atEnd: sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2,
               hidden };
    });
    ok(`[${name}] the bar stays at the bottom through a full scroll`,
       Math.abs(after.bottom - after.win) <= 1 && before === after.bottom,
       `${before} → ${after.bottom} of ${after.win}`);
    ok(`[${name}] the end of the page is reachable`, after.atEnd);
    ok(`[${name}] nothing at the foot of the page is underneath the bar`,
       after.hidden.length === 0, after.hidden.join(', ') || 'clear');
  }

  // ---------- the things that float over the shell ----------
  await page.evaluate(() => go('hire')); await page.waitForTimeout(1000);
  await page.locator('.wcard').first().click(); await page.waitForTimeout(600);
  const modal = await page.evaluate(() => {
    const o = document.getElementById('wOverlay');
    const m = o.querySelector('.modal').getBoundingClientRect();
    return { open: o.classList.contains('open'), pos: getComputedStyle(o).position,
             onScreen: m.top >= -1 && m.bottom <= window.innerHeight + 1 };
  });
  ok('A profile sheet still opens over the shell', modal.open && modal.pos === 'fixed');
  ok('…and fits inside the visible viewport', modal.onScreen);
  await page.evaluate(() => closeModal('wOverlay')); await page.waitForTimeout(400);

  await page.evaluate(() => openMenu()); await page.waitForTimeout(500);
  const drawer = await page.evaluate(() => ({
    open: document.getElementById('drawer').classList.contains('open'),
    locked: getComputedStyle(document.getElementById('scroll')).overflowY }));
  ok('The menu locks the middle, not a body that no longer scrolls',
     drawer.open && drawer.locked === 'hidden', JSON.stringify(drawer));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  await page.evaluate(() => document.body.classList.add('in-chat'));
  const chat = await page.evaluate(() => ({
    bar: document.getElementById('tabbar').offsetParent !== null,
    footer: document.querySelector('footer').offsetParent !== null,
    header: document.querySelector('body > header').offsetParent !== null }));
  ok('A conversation still hides the bar, the header and the footer',
     !chat.bar && !chat.footer && !chat.header, JSON.stringify(chat));
  await page.evaluate(() => document.body.classList.remove('in-chat'));

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
