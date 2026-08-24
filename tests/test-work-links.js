/* A worker's own website and social links.

   Somebody hiring an interior designer is deciding on rooms they have
   already seen, and three photographs on a profile cannot carry that. So a
   profile links out. What this guards is the line that makes linking out
   safe to allow.

   A wa.me link is not a portfolio. It is a one-tap route around
   request_worker_contact(), which is the function that decides whether a
   customer may have a number, rate-limits who asks, and leaves the record of
   it. Let those through and the app can no longer say who was put in touch
   with whom. The database refuses them; so does the form, so that somebody
   who types one is told before they lose a save rather than after.

   The rest is the ordinary hygiene of rendering a stranger's URL: https
   only, no credentials smuggled in front of the host, a cap on how many, and
   rel="ugc nofollow noopener" on every one of them — nofollow because
   otherwise people register fake profiles to farm backlinks off the domain,
   noopener because window.opener is a way back into the app. */
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
}).listen(8871);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

async function readyToPublish(page, phone, links) {
  await page.evaluate(p => {
    session = { phone: p, pin: '1234', name: 'Studio Borsha', registered: false };
    saveSession(); go('register'); initRegister();
  }, phone);
  await page.waitForTimeout(500);
  await page.evaluate(l => {
    picked = ['Interior Designer'];
    if (typeof renderPicked === 'function') renderPicked();
    document.querySelectorAll('.picked-card .sd-price').forEach(i => { i.value = '5000'; });
    selfieData = 'data:image/webp;base64,AAAA'; thumbData = selfieData;
    const a = document.getElementById('regArea'); if (a) a.value = 'Beltola';
    const lb = document.getElementById('regLinks'); if (lb) lb.value = l;
    document.getElementById('consentPublish').checked = true;
    document.getElementById('consentAge').checked = true;
    window._pricesConfirmed = true;
  }, links);
  await page.waitForTimeout(200);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8871/'); await page.waitForTimeout(1800);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {}; });

  // ---------- the field exists and says what it is for ----------
  await readyToPublish(page, '9876500061', '');
  const field = await page.evaluate(() => {
    const el = document.getElementById('regLinks');
    const wrap = el && el.closest('.field');
    return { there: !!el, says: wrap ? wrap.innerText.replace(/\s+/g, ' ') : '' };
  });
  ok('There is somewhere to put a portfolio', field.there);
  ok('…it is marked optional', /optional/i.test(field.says), field.says.slice(0, 70));
  ok('…and it says WhatsApp links will not be taken, before anybody tries',
     /WhatsApp/i.test(field.says));

  // ---------- the rules, checked without a round trip ----------
  const checks = await page.evaluate(() => ({
    wa:    checkLinks(['https://wa.me/919876500061']).error || null,
    tg:    checkLinks(['https://t.me/someone']).error || null,
    http:  checkLinks(['http://studioborsha.in']).error || null,
    creds: checkLinks(['https://instagram.com@evil.example/x']).error || null,
    six:   checkLinks(['https://a.in','https://b.in','https://c.in',
                       'https://d.in','https://e.in','https://f.in']).error || null,
    good:  checkLinks(['https://studioborsha.in/work',
                       'https://www.instagram.com/studioborsha']).links,
    named: checkLinks(['https://www.instagram.com/x']).links[0].kind,
    plain: checkLinks(['https://studioborsha.in']).links[0].kind,
    dupe:  checkLinks(['https://a.in','https://a.in']).links.length
  }));
  ok('A wa.me link is refused', !!checks.wa);
  ok('…and the message says why, not just no',
     /record of who contacted you/i.test(checks.wa || ''), (checks.wa || '').slice(0, 80));
  ok('A Telegram link is refused', !!checks.tg);
  ok('Plain http is refused', !!checks.http);
  ok('A host disguised with credentials in front of it is refused', !!checks.creds);
  ok('Six links are refused', !!checks.six);
  ok('Two good links get through', (checks.good || []).length === 2);
  ok('…instagram.com is labelled from the host', checks.named === 'Instagram', checks.named);
  ok('…and anything else is just a website', checks.plain === 'Website', checks.plain);
  ok('The same link twice is stored once', checks.dupe === 1, checks.dupe);

  // ---------- a bad link stops the save rather than being dropped ----------
  await readyToPublish(page, '9876500062', 'https://wa.me/919876500062');
  await page.evaluate(() => { regGo(4); saveProfile(); });
  await page.waitForTimeout(1200);
  ok('A wa.me link stops the save instead of vanishing quietly',
     await page.evaluate(() => currentScreen) !== 'done',
     await page.evaluate(() => currentScreen));
  ok('…and nothing was written',
     await page.evaluate(() => !demoAll().find(w => w.phone === '9876500062')));

  // ---------- the good path, end to end ----------
  await page.evaluate(() => { session = null; saveSession(); });
  await readyToPublish(page, '9876500063',
    'https://studioborsha.in/work\nhttps://www.instagram.com/studioborsha');
  await page.evaluate(() => { regGo(4); saveProfile(); });
  await page.waitForTimeout(1800);
  const stored = await page.evaluate(() =>
    (demoAll().find(w => w.phone === '9876500063') || {}).links);
  ok('Publishing with two links stores both', (stored || []).length === 2,
     JSON.stringify(stored));
  ok('…labelled by the database, not by whatever the client claimed',
     (stored || []).map(l => l.kind).join(',') === 'Website,Instagram',
     (stored || []).map(l => l.kind).join(','));

  // ---------- coming back to the form shows what is on file ----------
  await page.evaluate(() => { go('register'); initRegister(); });
  await page.waitForTimeout(700);
  ok('The edit form shows the links already saved',
     (await page.evaluate(() => document.getElementById('regLinks').value)).split('\n').length === 2);

  // ---------- and how they render to a customer ----------
  /* A profile card is only handed out for somebody approved and available —
     a freshly registered demo worker is neither, so approve them the way the
     review screen would. */
  const id = await page.evaluate(() => {
    const all = demoAll();
    const i = all.findIndex(w => w.phone === '9876500063');
    all[i].status = 'approved'; all[i].available = true;
    demoSave(all);
    return all[i].id;
  });
  await page.evaluate(() => { session = null; saveSession(); });
  /* The sheet renders from the last search's results, so put the worker
     there the way browsing would rather than reaching past it. */
  await page.evaluate(i => {
    workers = demoAll().filter(w => w.id === i);
    openWorker(i);
  }, id);
  await page.waitForTimeout(1200);
  const shown = await page.evaluate(() => {
    const as = [...document.querySelectorAll('#wOverlay .worklink')];
    return { n: as.length,
             rels: as.map(a => a.getAttribute('rel') || ''),
             targets: as.map(a => a.getAttribute('target') || ''),
             labels: as.map(a => a.textContent.trim()),
             cap: (document.querySelector('#wOverlay .wl-cap') || {}).textContent || '',
             tall: as.map(a => Math.round(a.getBoundingClientRect().height)) };
  });
  ok('Both links show on the profile', shown.n === 2, shown.n);
  ok('…under a caption, not as bare chips', /work/i.test(shown.cap), shown.cap);
  ok('…labelled Website and Instagram', shown.labels.join(',') === 'Website,Instagram',
     shown.labels.join(','));
  /* `every` on an empty list is true, which is how a render that produced
     nothing at all would sail through the four checks below. */
  ok('…every one is nofollow, so the domain is not worth farming',
     shown.n > 0 && shown.rels.every(r => /nofollow/.test(r) && /ugc/.test(r)), shown.rels.join(' | '));
  ok('…every one is noopener, so the opened page cannot reach back',
     shown.n > 0 && shown.rels.every(r => /noopener/.test(r)));
  ok('…and opens in its own tab rather than replacing the app',
     shown.n > 0 && shown.targets.every(t => t === '_blank'));
  ok('…each is a real target to hit',
     shown.n > 0 && shown.tall.every(h => h >= 32), shown.tall.join(','));

  // ---------- a profile with no links shows nothing at all ----------
  await page.evaluate(() => { closeModal('wOverlay'); });
  const bare = await page.evaluate(() => {
    const w = demoAll().find(x => !x.links || !x.links.length);
    return w ? workLinks(w) : 'no such worker';
  });
  ok('A profile with no links renders no empty caption', bare === '', JSON.stringify(bare));

  ok('No page errors', errors.length === 0, errors.join(' | '));
  await b.close(); srv.close();
})();
