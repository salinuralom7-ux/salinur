/* The badge, the breakdown, and the worker's own standing.

   Why any of this exists: a customer books a plumber here, gets his number
   when he accepts, and next time rings him directly. Nothing can detect that,
   so nothing here tries. Instead the five things that make up the score can
   only be earned inside the app — a worker who takes the job privately simply
   stops accruing them, and slides down the search results past the ones who
   did not.

   The scoring itself is proved against real Postgres by the migration's own
   checks, including that two workers on the same street sort by who answers.
   This is about what a person actually sees, and the two things that would
   make it unfair if they were wrong: that a new worker is never branded, and
   that nothing shown is a surprise to the worker it is about. */
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
}).listen(8848);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce',
    geolocation: { latitude: 26.1445, longitude: 91.7362 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8848/'); await page.waitForTimeout(2000);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {}; });

  // ---------- the badge in search ----------
  const total = await page.evaluate(() => {
    const all = demoAll();
    all[0].tier = 'platinum'; all[0].score = 91;
    all[1].tier = 'gold';     all[1].score = 76;
    all[2].tier = 'silver';   all[2].score = 61;
    demoSave(all);
    return all.length;
  });
  await page.evaluate(() => go('hire')); await page.waitForTimeout(1400);

  const badges = await page.locator('.wcard .tierbadge').allInnerTexts();
  ok('All three rungs show in search', badges.length === 3, badges.map(s => s.trim()).join(' | '));
  ok('Each names its rung',
     badges.join(' ').includes('Silver') && badges.join(' ').includes('Gold')
       && badges.join(' ').includes('Platinum'));
  const cards = await page.locator('.wcard').count();
  ok('Everybody else gets no badge rather than a bad one',
     cards === total && badges.length === 3, `${cards} cards, ${badges.length} badges`);

  // ---------- the breakdown on a profile ----------
  await page.evaluate(() => { api.scorecard = async () => ({
    score: 91, tier: 'platinum', jobs_done: 34, answered_pct: 96, on_time_pct: 93,
    finished_pct: 100, customers: 22, repeat_customers: 9, days_since_last: 2 }); });
  await page.locator('.wcard').first().click(); await page.waitForTimeout(800);
  const sc = await page.evaluate(() => ({
    text: (document.getElementById('wScore') || {}).innerText || '',
    lines: document.querySelectorAll('#wScore .sc-line').length,
    badge: (document.querySelector('#wScore .tierbadge') || {}).textContent || '',
  }));
  ok('The profile shows the reasons, not just the number', sc.lines >= 3, sc.lines + ' lines');
  ok('…the jobs finished, which is the public measure of experience',
     /34 jobs finished/.test(sc.text));
  ok('…the customers who came back — the one that answers the whole problem',
     /9 of 22/.test(sc.text));
  ok('…and says plainly that private work is not counted',
     /privately is not counted/.test(sc.text));
  ok('The badge is repeated on the card', /Platinum/.test(sc.badge), sc.badge.trim());
  await page.evaluate(() => closeModal('wOverlay')); await page.waitForTimeout(300);

  // ---------- a new worker is never branded ----------
  await page.evaluate(() => { api.scorecard = async () => ({
    score: null, tier: null, jobs_done: 2, answered_pct: 100, on_time_pct: null,
    finished_pct: 100, customers: 2, repeat_customers: 0, days_since_last: 1 }); });
  await page.evaluate(() => { const all = demoAll();
    all.forEach(w => { delete w.tier; delete w.score; }); demoSave(all); go('hire'); });
  await page.waitForTimeout(1200);
  await page.locator('.wcard').first().click(); await page.waitForTimeout(800);
  const fresh = await page.evaluate(() => ({
    badges: document.querySelectorAll('.tierbadge').length,
    card: ((document.getElementById('wScore') || {}).innerText || '').trim(),
  }));
  ok('Somebody with two jobs is shown no badge at all', fresh.badges === 0);
  ok('…and no empty scorecard either — that says less than none', fresh.card === '', fresh.card.slice(0, 40));
  await page.evaluate(() => closeModal('wOverlay')); await page.waitForTimeout(300);

  // ---------- the worker's own standing ----------
  await page.evaluate(() => {
    const w = demoAll()[0]; w.tier = 'gold'; w.score = 76;
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession();
    api.scorecard = async () => ({ score: 76, tier: 'gold', jobs_done: 14, answered_pct: 81,
      on_time_pct: 88, finished_pct: 93, customers: 11, repeat_customers: 3, days_since_last: 4 });
    api.myMonths = async () => ([
      { month:'2026-08-01', finished:4, earned:1600 },
      { month:'2026-07-01', finished:6, earned:2400 },
      { month:'2026-06-01', finished:2, earned:800 },
      { month:'2026-05-01', finished:2, earned:900 }]);
    go('me');
  });
  await page.waitForTimeout(1200);
  const me = await page.evaluate(() => ({
    badge: (document.querySelector('#meScore .tierbadge') || {}).textContent || '',
    next: (document.querySelector('#meScore .sc-note b') || {}).textContent || '',
    counts: [...document.querySelectorAll('.mo-chart .mbar b')].map(e => e.textContent),
    text: (document.getElementById('meScore') || {}).innerText || '',
  }));
  ok('The worker sees the same badge a customer does', /Gold/.test(me.badge), me.badge.trim());
  ok('…and exactly what the next rung takes', /Platinum/.test(me.next) && /16 more/.test(me.text),
     me.next + ' — ' + (me.text.match(/16 more[^.]*/) || [''])[0]);
  ok('Month by month is drawn', me.counts.length === 4, me.counts.join(','));
  ok('…oldest on the left, so the shape of the year reads correctly',
     JSON.stringify(me.counts) === JSON.stringify(['2','2','6','4']), me.counts.join(','));
  ok('…and the same five lines the customer sees, so nothing is a surprise',
     await page.locator('#meScore .sc-line').count() >= 3);
  ok('It tells the worker straight that private work earns nothing',
     /does nothing for your badge/.test(me.text));

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
