/* Permission to use somebody's face.

   The publish box already covers the profile card, which is the service: a
   customer cannot pick a plumber they cannot see. It does not cover putting
   that person's face on a home-screen tile or in an Instagram post, which is
   advertising — and bundling that into a tickbox somebody must accept in
   order to register is not consent, because refusing it would mean no
   profile.

   So it is a separate question and it is optional. What this guards is that
   it stays optional, that the answer is actually recorded, that unticking it
   really withdraws, and that re-saving a profile does not quietly re-date a
   permission given months ago. */
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
}).listen(8856);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

/* Fill the wizard to the last step without answering the optional question. */
async function readyToPublish(page, phone) {
  await page.evaluate(p => {
    session = { phone: p, pin: '1234', name: 'Consent Tester', registered: false };
    saveSession(); go('register'); initRegister();
  }, phone);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    picked = ['Plumber'];
    if (typeof renderPicked === 'function') renderPicked();
    document.querySelectorAll('.picked-card .sd-price').forEach(i => { i.value = '300'; });
    selfieData = 'data:image/webp;base64,AAAA'; thumbData = selfieData;
    const a = document.getElementById('regArea'); if (a) a.value = 'Beltola';
    const e = document.getElementById('regEmail'); if (e) e.value = 'consent@example.com';
    document.getElementById('consentPublish').checked = true;
    document.getElementById('consentAge').checked = true;
    window._pricesConfirmed = true;
  });
  await page.waitForTimeout(200);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8856/'); await page.waitForTimeout(1800);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {}; });

  // ---------- the question is asked, and asked separately ----------
  await readyToPublish(page, '9876500051');
  await page.evaluate(() => regGo(4));
  await page.waitForTimeout(400);
  const box = await page.evaluate(() => {
    const el = document.getElementById('consentPhotoPromo');
    const row = el && el.closest('.consent-row');
    return { there: !!el, checked: el ? el.checked : null,
             optional: !!(row && row.classList.contains('optional')),
             says: row ? row.innerText.replace(/\s+/g, ' ') : '',
             rows: document.querySelectorAll('#consentBlock .consent-row').length };
  });
  ok('The question is on the form', box.there);
  ok('…as a third row, not folded into the publish box', box.rows === 3, box.rows + ' rows');
  ok('…starting unticked, because nobody has agreed yet', box.checked === false);
  ok('…and it says out loud that it is optional', /Optional/.test(box.says) && box.optional,
     box.says.slice(0, 96));
  ok('…and names the use it is actually asking for',
     /elsewhere in the app/.test(box.says) && /posts/.test(box.says));

  // ---------- leaving it alone must not block anybody ----------
  await page.evaluate(() => saveProfile());
  await page.waitForTimeout(1800);
  ok('Publishing without answering it works',
     await page.evaluate(() => currentScreen) === 'done',
     await page.evaluate(() => currentScreen));
  ok('…and no permission was recorded',
     await page.evaluate(() => (demoAll().find(w => w.phone === '9876500051') || {}).photo_promo_at) == null);

  // ---------- ticking it records the moment ----------
  await page.evaluate(() => { session = null; saveSession(); });
  await readyToPublish(page, '9876500052');
  await page.evaluate(() => { regGo(4); document.getElementById('consentPhotoPromo').checked = true; });
  await page.waitForTimeout(300);
  await page.evaluate(() => saveProfile());
  await page.waitForTimeout(1800);
  const given = await page.evaluate(() => (demoAll().find(w => w.phone === '9876500052') || {}).photo_promo_at);
  ok('Ticking it records a date', !!given, given || 'nothing');

  // ---------- and the form shows what is on file, so it can be withdrawn ----------
  await page.evaluate(() => { go('register'); initRegister(); });
  await page.waitForTimeout(700);
  ok('Coming back, the box shows the permission already given',
     await page.evaluate(() => document.getElementById('consentPhotoPromo').checked) === true);

  await page.evaluate(() => {
    document.getElementById('consentPhotoPromo').checked = false;
    regGo(4); window._pricesConfirmed = true;
    selfieData = 'data:image/webp;base64,AAAA'; thumbData = selfieData;
    saveProfile();
  });
  await page.waitForTimeout(1800);
  ok('Unticking it withdraws the permission',
     await page.evaluate(() => (demoAll().find(w => w.phone === '9876500052') || {}).photo_promo_at) == null);

  // ---------- re-saving must not re-date a permission given long ago ----------
  const OLD = '2026-01-09T04:00:00.000Z';
  await page.evaluate(o => {
    const all = demoAll(); const w = all.find(x => x.phone === '9876500052');
    w.photo_promo_at = o; demoSave(all);
    session.worker.photo_promo_at = o; saveSession();
  }, OLD);
  await page.evaluate(() => {
    document.getElementById('consentPhotoPromo').checked = true;
    regGo(4); window._pricesConfirmed = true;
    selfieData = 'data:image/webp;base64,AAAA'; thumbData = selfieData;
    saveProfile();
  });
  await page.waitForTimeout(1800);
  ok('Saving again keeps the date it was actually agreed',
     await page.evaluate(() => (demoAll().find(w => w.phone === '9876500052') || {}).photo_promo_at) === OLD,
     await page.evaluate(() => (demoAll().find(w => w.phone === '9876500052') || {}).photo_promo_at));

  // ---------- the reviewer can see the answer ----------
  await page.evaluate(() => {
    const all = demoAll();
    const yes = all.find(w => w.phone === '9876500052');
    const no  = all.find(w => w.phone === '9876500051');
    yes.selfie = 'data:image/webp;base64,AAAA'; yes.status = 'pending';
    no.selfie  = 'data:image/webp;base64,AAAA'; no.status  = 'pending';
    demoSave(all);
    localStorage.setItem('nearse_preview_admin', '4242');
  });
  page.on('dialog', d => d.accept('4242'));
  await page.goto('http://localhost:8856/#admin'); await page.waitForTimeout(1800);
  await page.evaluate(() => setAdminTab('review'));   // the queue, not the numbers
  await page.waitForTimeout(1400);
  const flags = await page.evaluate(() => [...document.querySelectorAll('.promo-flag')]
    .map(e => (e.classList.contains('yes') ? 'YES ' : 'NO ') + e.textContent.trim().replace(/\s+/g, ' ')));
  ok('The review screen says whether the photo may be reused', flags.length >= 2, flags.length + ' cards flagged');
  ok('…naming the date when it may', flags.some(f => f.startsWith('YES') && /agreed/.test(f)),
     (flags.find(f => f.startsWith('YES')) || '').slice(0, 84));
  ok('…and saying plainly when it may not',
     flags.some(f => f.startsWith('NO') && /this profile only/.test(f)),
     (flags.find(f => f.startsWith('NO')) || '').slice(0, 84));

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
