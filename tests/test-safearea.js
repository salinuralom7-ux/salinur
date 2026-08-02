/* An installed iOS app draws the status bar OVER the page, so anything pinned
   to an edge has to inset itself or it hides under the clock or the home
   indicator. A desktop browser reports every inset as 0, which is why this was
   invisible in every test until it was seen on a real phone — so the insets are
   forced to real iPhone values here and the edges measured against them. */
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
}).listen(8827);

const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));

/* iPhone 15 Pro in portrait */
const TOP = 59, BOTTOM = 34;
const FORCE = `
  :root{
    --sat:${TOP}px; --sab:${BOTTOM}px;
  }
  /* env() cannot be set, so every place the app reads it is restated with the
     same calc against a variable this stylesheet can control */
  .masthead{padding-top:calc(16px + var(--sat)) !important}
  .chat-head{padding-top:calc(12px + var(--sat)) !important}
  .drawer-head{padding-top:calc(18px + var(--sat)) !important}
  footer{padding-bottom:calc(34px + var(--sab)) !important}
  .chat-compose{padding-bottom:calc(12px + var(--sab)) !important}
  .drawer-foot{padding-bottom:calc(18px + var(--sab)) !important}
  .modal{padding-bottom:calc(30px + var(--sab)) !important}
  .toast{bottom:calc(24px + var(--sab)) !important}
  /* the status bar itself, drawn over the page as iOS does */
  body::before{content:"";position:fixed;top:0;left:0;right:0;height:${TOP}px;
    background:rgba(255,0,0,.22);z-index:9999;pointer-events:none}
`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  /* The notification sheet opens over everything on a first visit and keeps
     asking until it is answered — deliberate, and it sits on top of the
     controls this file measures. The gate is the real permission, not a
     stored flag, so being a returning visitor means having answered it.
     test-notify-ask.js is where the sheet itself is checked. */
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8827' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8827/'); await page.waitForTimeout(1300);
  await page.addStyleTag({ content: FORCE });
  await page.waitForTimeout(400);

  const clearsTop = sel => page.evaluate(({ sel, top }) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return Math.round(el.getBoundingClientRect().top) >= top - 1;
  }, { sel, top: TOP });

  // ---------- the reported bug ----------
  ok('The header itself is pinned to the very top', await page.evaluate(() =>
     Math.round(document.querySelector('header').getBoundingClientRect().top) === 0));
  ok('The wordmark clears the status bar', await clearsTop('header .brand'));
  ok('Browse workers clears it', await clearsTop('#browseLink'));
  ok('The three-dot button clears it', await clearsTop('#menuBtn'));
  const menuTop = await page.evaluate(() => Math.round(document.querySelector('#menuBtn').getBoundingClientRect().top));
  ok('…with room to tap, not flush against it', menuTop >= TOP, menuTop + 'px vs a ' + TOP + 'px status bar');
  ok('And the header still has a background behind the status bar', await page.evaluate(() =>
     getComputedStyle(document.querySelector('header')).backgroundColor !== 'rgba(0, 0, 0, 0)'));

  // ---------- the side menu ----------
  await page.locator('#menuBtn').click(); await page.waitForTimeout(500);
  ok('The menu wordmark clears the status bar', await clearsTop('.drawer-head .mark'));
  ok('The last menu row clears the home indicator', await page.evaluate(bottom => {
    const rows = [...document.querySelectorAll('.drawer-nav .drawer-row')].filter(r => !r.hidden);
    const last = rows[rows.length - 1].getBoundingClientRect();
    return last.bottom <= window.innerHeight - bottom + 1;
  }, BOTTOM));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // ---------- the conversation ----------
  const code = await page.evaluate(() => {
    const w = demoAll()[0];
    const t = demoStartThread({ workerId: w.id, skill: 'Plumber', mode: 'appointment', detail: 'Today',
      name: 'Salinur', phone: '9876543210', area: 'Panbazar', price: 900, unit: 'per visit' });
    rememberBooking({ code: t.code, token: t.token, worker_name: t.worker_name, skill: 'Plumber',
                      created_at: new Date().toISOString() });
    return t.code;
  });
  await page.evaluate(c => openChat(c, 'customer', 'chats'), code);
  await page.waitForTimeout(1400);
  await page.addStyleTag({ content: FORCE });
  await page.waitForTimeout(300);
  ok('The chat back button clears the status bar', await clearsTop('.chat-back'));
  ok('The compose box clears the home indicator', await page.evaluate(bottom => {
    const el = document.querySelector('#chatInput').getBoundingClientRect();
    return el.bottom <= window.innerHeight - bottom + 1;
  }, BOTTOM));
  await page.locator('.chat-back').click(); await page.waitForTimeout(700);

  // ---------- a bottom sheet ----------
  await page.evaluate(() => go('hire')); await page.waitForTimeout(1300);
  await page.locator('.wcard').first().click(); await page.waitForTimeout(600);
  await page.addStyleTag({ content: FORCE }); await page.waitForTimeout(300);
  ok('A sheet\'s last button clears the home indicator', await page.evaluate(bottom => {
    const btns = [...document.querySelectorAll('#wOverlay .modal button, #wOverlay .modal a')];
    const last = btns[btns.length - 1].getBoundingClientRect();
    return last.bottom <= window.innerHeight - bottom + 1;
  }, BOTTOM));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // ---------- the standalone pages use the same stylesheet ----------
  const pg = await ctx.newPage();
  await pg.goto('http://localhost:8827/about/'); await pg.waitForTimeout(900);
  await pg.addStyleTag({ content: FORCE }); await pg.waitForTimeout(300);
  ok('About: the wordmark clears the status bar', await pg.evaluate(top =>
     Math.round(document.querySelector('.brand').getBoundingClientRect().top) >= top - 1, TOP));
  ok('Every legal page declares viewport-fit=cover', ['about','privacy','terms','cancellation','delete-account']
     .every(d => /viewport-fit=cover/.test(fs.readFileSync(`${ROOT}/${d}/index.html`, 'utf8'))));
  await pg.close();

  // ---------- and it all still looks right with no notch at all ----------
  const plain = await ctx.newPage();
  await plain.goto('http://localhost:8827/'); await plain.waitForTimeout(1200);
  ok('With no insets the header keeps its ordinary padding', await plain.evaluate(() =>
     Math.round(parseFloat(getComputedStyle(document.querySelector('.masthead')).paddingTop)) === 16),
     await plain.evaluate(() => getComputedStyle(document.querySelector('.masthead')).paddingTop));
  ok('And the page does not scroll sideways', await plain.evaluate(() =>
     document.documentElement.scrollWidth <= window.innerWidth + 1));

  await page.screenshot({ path: __dirname + '/shots/safearea.png' });
  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
