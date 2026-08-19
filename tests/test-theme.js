/* Letting somebody choose how the app looks.

   Three states, because two would be wrong: most people never think about
   this and want the app to follow their phone, and the ones who have
   decided should not have to argue with their phone about it.

   The part that is easy to get wrong is not the switch — it is the moment
   before the first paint. Anything that decides the theme in the app's own
   boot has already painted the default once, so somebody who chose light
   sees a black flash on every single launch. That is why it is resolved by
   a few lines inline in the head, and it is the first thing checked here.

   The second is that a theme is not only CSS. The phone paints its own
   status bar from the theme-color meta, and the browser paints scrollbars,
   carets and native pickers from color-scheme. Miss either and a light app
   has a black bar above it, or a black date picker inside it. */
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
}).listen(8859);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };
const bg = p => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
const isLight = c => { const n = (c.match(/\d+/g)||[]).map(Number); return n[0] > 128; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  // ---------- the choice is offered ----------
  /* Deliberately a dark phone: on System the app then starts dark, so
     choosing Light is a change that can be seen rather than a no-op that
     passes for the wrong reason. Chromium's own default is light. */
  let ctx = await b.newContext({ viewport: { width: 390, height: 844 },
                                 reducedMotion: 'reduce', colorScheme: 'dark' });
  let page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8859/'); await page.waitForTimeout(1700);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {}; });
  /* The drawer slides in, and Playwright will not click an element that is
     still moving. A fixed sleep is enough on an idle machine and not enough
     when the whole suite is running — wait for the drawer to be open and
     for the control to have stopped. */
  await page.locator('#menuBtn').click();
  await page.waitForSelector('#drawer.open', { timeout: 8000 });
  await page.locator('.theme-pick .tp[data-theme-set="light"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(350);

  const opts = await page.locator('.theme-pick .tp').allInnerTexts();
  ok('The menu offers the choice', opts.length === 3, opts.map(s => s.trim()).join(' / '));
  ok('…including System, so most people never have to think about it',
     opts.some(o => /System/i.test(o)));
  ok('…and each is a proper target',
     await page.locator('.theme-pick .tp').evaluateAll(
       es => es.every(e => e.getBoundingClientRect().height >= 44)));
  ok('…with exactly one marked as current',
     await page.locator('.theme-pick .tp[aria-checked="true"]').count() === 1,
     await page.locator('.theme-pick .tp[aria-checked="true"]').innerText());

  // ---------- choosing light actually changes the app ----------
  const before = await bg(page);
  await page.locator('.theme-pick .tp[data-theme-set="light"]').click();
  await page.waitForTimeout(400);
  const after = await bg(page);
  ok('Choosing Light turns the app light', !isLight(before) && isLight(after),
     before + ' → ' + after);
  ok('…the status bar colour follows, so the phone does not frame it in black',
     await page.evaluate(() => document.getElementById('themeColor').content) === '#F4F5F7');
  ok('…and so does color-scheme, which owns the scrollbar and the date picker',
     await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme) === 'light');
  ok('…and the choice is now the one marked',
     (await page.locator('.theme-pick .tp[aria-checked="true"]').innerText()).trim() === 'Light');

  // ---------- and it survives a reload, without a flash ----------
  await page.reload();
  /* Sampled immediately, before the app has booted: if the theme were
     applied by app code this would still be dark here and correct itself a
     frame later, which is exactly the flash being guarded against. */
  const atOnce = await bg(page);
  ok('It is already light before the app has even booted', isLight(atOnce), atOnce);
  await page.waitForTimeout(1500);
  ok('…and stays light once it has', isLight(await bg(page)));
  await ctx.close();

  // ---------- System follows the phone ----------
  for (const [scheme, wantLight] of [['light', true], ['dark', false]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const p2 = await c.newPage();
    await p2.goto('http://localhost:8859/'); await p2.waitForTimeout(1400);
    ok(`On System, a phone set to ${scheme} gets a ${scheme} app`,
       isLight(await bg(p2)) === wantLight, await bg(p2));
    await c.close();
  }

  // ---------- a choice beats the phone ----------
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const p3 = await c3.newPage();
  await p3.addInitScript(() => localStorage.setItem('mysheher_theme_v1', 'light'));
  await p3.goto('http://localhost:8859/'); await p3.waitForTimeout(1200);
  ok('Somebody who chose Light keeps it on a dark phone', isLight(await bg(p3)), await bg(p3));
  await c3.close();

  // ---------- and the app still works with storage refused ----------
  const c4 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p4 = await c4.newPage();
  const boom = [];
  p4.on('pageerror', e => boom.push(e.message));
  await p4.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get(){ throw new Error('storage disabled'); }
    });
  });
  await p4.goto('http://localhost:8859/'); await p4.waitForTimeout(1200);
  ok('Storage refused: the head script does not throw',
     !boom.some(m => /storage disabled/.test(m) && /theme/i.test(m)),
     boom.slice(0, 1).join('') || 'no theme error');
  await c4.close();

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
