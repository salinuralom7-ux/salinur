/* Builders, and the number that vouches for them.

   The catalogue had people who build part of a house — masons, tile fitters,
   a "Civil Contractor" — and nobody who builds one. That is the search
   somebody makes when they have a plot and no idea who to call, and it is
   the largest amount of money anybody will spend through this app.

   The trades are the easy half. The hard half is that every other listing
   here is vouched for by a photograph and a phone call, which is
   proportionate at three hundred rupees for a tap and absurd at fifteen lakh
   for a house. So construction asks for a GSTIN — free to check, mandatory
   at this volume of work, and verifiable by the customer on the government's
   own portal. That last part is the point: the app is not asking anybody to
   trust the app, it is handing over something checkable.

   What this file guards: that the number is demanded, that it is validated
   properly rather than merely looked at, that it is not shown until a person
   here has confirmed it, and that the one warning worth giving at this price
   is actually given. */
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
}).listen(8875);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };
const GOOD = '18AABCU9603R1ZM';

async function ready(page, phone, trade, gstin) {
  await page.evaluate(p => {
    session = { phone: p, pin: '1234', name: 'Borsha Builders', registered: false };
    saveSession(); go('register'); initRegister();
  }, phone);
  await page.waitForTimeout(500);
  await page.evaluate(([t, g]) => {
    picked = [t];
    if (typeof renderPicked === 'function') renderPicked();
    if (typeof renderModeBlocks === 'function') renderModeBlocks();
    document.querySelectorAll('.picked-card .sd-price').forEach(i => { i.value = '1800'; });
    selfieData = 'data:image/webp;base64,AAAA'; thumbData = selfieData;
    const a = document.getElementById('regArea'); if (a) a.value = 'Beltola';
    const gb = document.getElementById('regGstin'); if (gb) gb.value = g;
    document.getElementById('consentPublish').checked = true;
    document.getElementById('consentAge').checked = true;
    window._pricesConfirmed = true;
  }, [trade, gstin]);
  await page.waitForTimeout(200);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8875/'); await page.waitForTimeout(1800);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {}; });

  // ---------- somebody who builds a whole house is now findable ----------
  const cat = await page.evaluate(() => {
    const g = CATALOGUE.find(x => x[0] === 'build');
    const names = g[2].map(s => s[0]);
    return { names, unpriced: g[2].filter(s => !RATE_BAND[s[0]]).map(s => s[0]),
             unit: (g[2].find(s => s[0] === 'House Construction (Turnkey)') || [])[1],
             badUnit: g[2].filter(s => !UNITS.includes(s[1])).map(s => s[0]) };
  });
  ok('Turnkey house construction is in the catalogue',
     cat.names.includes('House Construction (Turnkey)'));
  ok('…so is labour-only, which is the other contract people sign',
     cat.names.includes('Building Contractor (Labour Only)'));
  ok('…and the trades around a build: RCC, roofing, borewell, plan approval',
     ['RCC & Structural Work','Roofing & Shed Contractor','Borewell & Tubewell Drilling',
      'Building Plan & Approval Consultant'].every(n => cat.names.includes(n)));
  ok('…priced per square foot, the way construction is actually quoted here',
     cat.unit === 'per sq ft', cat.unit);
  ok('…every new trade has a price band', cat.unpriced.length === 0, cat.unpriced.join(', '));
  ok('…and every unit is one the database will accept',
     cat.badUnit.length === 0, cat.badUnit.join(', '));

  // ---------- the GSTIN check is real arithmetic, not a glance ----------
  const g = await page.evaluate(() => ({
    /* The canonical example from the GST documentation. If the check digit
       routine is wrong, this is what says so. */
    canonical: gstCheckChar('27AAPFU0939F1Z'),
    good:   checkGstin('18AABCU9603R1ZM').gstin,
    messy:  checkGstin('  18aabcu9603r1zm ').gstin,
    digit:  checkGstin('18AABCU9603R1ZX').error || null,
    state:  checkGstin('07AABCU9603R1ZV').error || null,
    shape:  checkGstin('NOTAGSTNUMBER').error || null,
    empty:  checkGstin('').gstin,
    emptyE: checkGstin('').error || null
  }));
  ok('The check-digit routine matches the documented GSTIN', g.canonical === 'V', g.canonical);
  ok('A valid Assam GSTIN is accepted', g.good === GOOD, g.good);
  ok('…typed with spaces and lower case, it still is', g.messy === GOOD, g.messy);
  ok('A wrong check digit is caught', /check digit/.test(g.digit || ''), g.digit);
  ok('An out-of-state registration is caught', /not Assam/.test(g.state || ''), g.state);
  ok('Nonsense is caught', !!g.shape);
  ok('An empty box is not an error, just empty', g.empty === null && g.emptyE === null);

  // ---------- who is asked ----------
  await ready(page, '9876500081', 'Plumber', '');
  ok('A plumber is not asked for a GST number',
     await page.evaluate(() => document.getElementById('regGstBlock').hidden) === true);
  await ready(page, '9876500081', 'House Construction (Turnkey)', '');
  const blk = await page.evaluate(() => {
    const el = document.getElementById('regGstBlock');
    return { hidden: el.hidden, says: el.innerText.replace(/\s+/g, ' ') };
  });
  ok('A builder is', blk.hidden === false);
  ok('…and is told it will be published and checked, before typing it',
     /publish/i.test(blk.says) && /check it against the portal/i.test(blk.says));

  // ---------- and it is not optional ----------
  await page.evaluate(() => { regGo(4); saveProfile(); });
  await page.waitForTimeout(1200);
  ok('A builder with no GST number is not published',
     await page.evaluate(() => !demoAll().find(w => w.phone === '9876500081')));

  await ready(page, '9876500082', 'House Construction (Turnkey)', '18AABCU9603R1ZX');
  await page.evaluate(() => { regGo(4); saveProfile(); });
  await page.waitForTimeout(1200);
  ok('A mistyped GST number is not published either',
     await page.evaluate(() => !demoAll().find(w => w.phone === '9876500082')));

  // ---------- the good path ----------
  await page.evaluate(() => { session = null; saveSession(); });
  await ready(page, '9876500083', 'House Construction (Turnkey)', GOOD);
  await page.evaluate(() => { regGo(4); saveProfile(); });
  await page.waitForTimeout(1800);
  const rec = await page.evaluate(() => demoAll().find(w => w.phone === '9876500083') || {});
  ok('A real GST number gets the builder published', !!rec.id);
  ok('…it is stored', rec.gstin === GOOD, rec.gstin);
  ok('…and nobody has looked it up yet', !rec.gstin_checked_at);

  // ---------- unchecked means invisible ----------
  const id = await page.evaluate(() => {
    const all = demoAll();
    const i = all.findIndex(w => w.phone === '9876500083');
    all[i].status = 'approved'; all[i].available = true; demoSave(all);
    return all[i].id;
  });
  const sheet = async () => {
    await page.evaluate(i => { workers = demoAll().filter(w => w.id === i); openWorker(i); }, id);
    await page.waitForTimeout(900);
    const out = await page.evaluate(() => ({
      text: (document.getElementById('wGst') || {}).innerText || '',
      warn: document.querySelectorAll('#wOverlay .gst-warn').length
    }));
    await page.evaluate(() => closeModal('wOverlay'));
    return out;
  };
  let v = await sheet();
  ok('An unchecked GST number is shown to nobody', v.text.trim() === '', v.text.trim());

  await page.evaluate(i => {
    const all = demoAll();
    all.find(x => x.id === i).gstin_checked_at = new Date().toISOString();
    demoSave(all);
  }, id);
  v = await sheet();
  ok('Once checked, the number is on the profile', v.text.includes(GOOD), v.text.replace(/\s+/g,' '));
  ok('…and says where it was checked', /government portal/i.test(v.text));
  ok('…and the one warning worth giving at this price is given', v.warn === 1);
  ok('…which names what MySheher cannot do about an advance',
     /cannot get an advance back/i.test(v.text));

  // ---------- and is not given on a three-hundred-rupee job ----------
  const quiet = await page.evaluate(() => {
    const w = { gstin: '18AABCU9603R1ZM',
                skills: [{ skill: 'Plumber', price: 300, unit: 'per visit' }] };
    return workGst(w);
  });
  ok('A plumber with a GST number gets no building warning',
     !/gst-warn/.test(quiet) && /18AABCU9603R1ZM/.test(quiet));

  ok('No page errors', errors.length === 0, errors.join(' | '));
  await b.close(); srv.close();
})();
