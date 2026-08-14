/* "Publish my profile" did nothing, however many times it was pressed.

   The cause was window.confirm(). Anybody pricing at the top of their trade's
   band hit a confirm() asking them to think again, and a dismissed confirm
   returned false straight into a bare `return` — no message, no toast,
   nothing. Two ordinary things make that dialog never appear at all:

     Chrome offers "prevent this page from creating additional dialogs" after
     a couple of dismissals. Once ticked, every later confirm() returns false
     instantly and draws nothing. The button is then dead forever.

     The wording listed "Go back and lower it" before "publish at this
     price", so Cancel felt like the right button to somebody who wanted to
     publish.

   Both are gone. The question is a sheet the app draws itself, which no
   browser can suppress, and both answers are buttons with words on them. The
   one that means "not now" says so out loud instead of returning in silence.

   What this test really guards is the silence. A validation that stops a
   publish is fine; a publish that stops for no visible reason is not. */
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
}).listen(8849);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

/* Fill the wizard to the point of publishing, pricing at the top of the band
   because that is the branch that used to be fatal. */
async function readyToPublish(page, phone) {
  await page.evaluate(p => {
    session = { phone: p, pin: '1234', name: 'Test Person', registered: false };
    saveSession(); go('register'); initRegister();
  }, phone);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    picked = ['Plumber'];
    if (typeof renderPicked === 'function') renderPicked();
    const band = (typeof RATE_BAND !== 'undefined' && RATE_BAND['Plumber']) || [100, 2500];
    document.querySelectorAll('.picked-card .sd-price').forEach(i => { i.value = String(band[1]); });
    selfieData = 'data:image/webp;base64,AAAA'; thumbData = selfieData;
    const a = document.getElementById('regArea'); if (a) a.value = 'Beltola';
    const c1 = document.getElementById('consentPublish'), c2 = document.getElementById('consentAge');
    if (c1) c1.checked = true; if (c2) c2.checked = true;
    window._pricesConfirmed = false;
  });
  await page.waitForTimeout(200);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  /* Playwright dismisses native dialogs by default, which is exactly the
     state a phone is left in once Chrome's dialog suppression is on. If any
     native dialog is reached at all, this records it and the test fails. */
  const native = []; page.on('dialog', async d => { native.push(d.type() + ': ' + d.message().slice(0, 60)); await d.dismiss(); });

  await page.goto('http://localhost:8849/'); await page.waitForTimeout(2000);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {}; });

  // ---------- the question is the app's own ----------
  await readyToPublish(page, '9876500011');
  page.evaluate(() => saveProfile());
  await page.waitForTimeout(900);
  const sheet = await page.evaluate(() => ({
    open: document.getElementById('askOverlay').classList.contains('open'),
    title: (document.getElementById('askTitle') || {}).textContent || '',
    yes: (document.getElementById('askYes') || {}).textContent || '',
    no: (document.getElementById('askNo') || {}).textContent || '',
  }));
  ok('Publishing at a high price asks, in the app', sheet.open, sheet.title);
  ok('No native browser dialog is used', native.length === 0, native.join(' | ') || 'none');
  ok('Both answers are words, not OK and Cancel',
     /Publish at this price/.test(sheet.yes) && /Go back/.test(sheet.no),
     `${sheet.yes} / ${sheet.no}`);

  // ---------- and it actually publishes ----------
  await page.evaluate(() => document.getElementById('askYes').click());
  await page.waitForTimeout(1600);
  ok('Choosing to publish publishes',
     await page.evaluate(() => currentScreen) === 'done',
     await page.evaluate(() => currentScreen));

  // ---------- the other answer is never silent ----------
  await page.evaluate(() => { session = null; saveSession(); });
  await readyToPublish(page, '9876500012');
  page.evaluate(() => saveProfile());
  await page.waitForTimeout(900);
  await page.evaluate(() => document.getElementById('askNo').click());
  await page.waitForTimeout(700);
  const backed = await page.evaluate(() => ({
    screen: currentScreen,
    toast: (document.querySelector('.toast.show') || {}).textContent || '',
    open: document.getElementById('askOverlay').classList.contains('open'),
  }));
  ok('Choosing to change the price closes the question', !backed.open);
  ok('…leaves them on the form rather than half-published', backed.screen === 'register', backed.screen);
  ok('…and SAYS nothing was published — the whole bug was the silence',
     /Nothing published/.test(backed.toast), backed.toast || '(silence)');

  // ---------- dismissing by tapping outside is the same, not a dead end ----------
  await page.evaluate(() => { const t = document.getElementById('toast'); t.className = 'toast'; });
  page.evaluate(() => saveProfile());
  await page.waitForTimeout(900);
  await page.evaluate(() => { const o = document.getElementById('askOverlay');
    o.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(700);
  const outside = await page.evaluate(() => ({
    open: document.getElementById('askOverlay').classList.contains('open'),
    toast: (document.querySelector('.toast.show') || {}).textContent || '',
  }));
  ok('Tapping outside the question also answers it', !outside.open);
  ok('…and is equally not silent', /Nothing published/.test(outside.toast), outside.toast || '(silence)');

  // ---------- pressing it repeatedly cannot wedge it ----------
  await page.evaluate(() => { const t = document.getElementById('toast'); t.className = 'toast'; });
  for (let i = 0; i < 3; i++) { page.evaluate(() => saveProfile()); await page.waitForTimeout(350); }
  await page.waitForTimeout(500);
  const repeated = await page.evaluate(() => ({
    open: document.getElementById('askOverlay').classList.contains('open'),
    sheets: document.querySelectorAll('#askOverlay').length,
  }));
  ok('Pressing Publish three times leaves one question, still answerable',
     repeated.open && repeated.sheets === 1, `${repeated.sheets} sheet(s), open ${repeated.open}`);
  await page.evaluate(() => document.getElementById('askYes').click());
  await page.waitForTimeout(1500);
  ok('…and it still publishes afterwards',
     await page.evaluate(() => currentScreen) === 'done',
     await page.evaluate(() => currentScreen));

  ok('No native dialog anywhere in the publish path', native.length === 0, native.join(' | ') || 'none');
  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
