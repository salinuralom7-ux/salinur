/* The punctuality question, which used to record a black mark against a
   worker whenever somebody dismissed a confirm() box, and the worker calls
   that now travel on a session token rather than a PIN. */
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
}).listen(8821);

const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  /* The notification sheet opens a couple of seconds in and sits over the
     punctuality sheet this file is about, so its buttons never get clicked.
     Answering the real permission is what makes the app stop asking — a
     localStorage flag is not the gate. test-notify-ask.js checks that sheet. */
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8821' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // if anything still reaches for a browser dialog here, fail loudly
  let dialogs = 0;
  page.on('dialog', d => { dialogs++; d.dismiss(); });
  await page.goto('http://localhost:8821/'); await page.waitForTimeout(1200);

  // ---------- the question is a sheet, not a confirm ----------
  await page.evaluate(() => {
    localStorage.setItem('nearse_job_done_v1', JSON.stringify({ code: 'ABCDEF0123', token: 'tok-1' }));
  });
  await page.evaluate(() => maybeAskPunctuality());
  await page.waitForTimeout(1800);
  ok('It asks in a sheet, not a browser dialog',
     await page.locator('#punctOverlay.open').count() === 1 && dialogs === 0);
  const opts = (await page.locator('#punctOverlay button.btn').allTextContents()).map(t => t.trim());
  ok('Three answers offered, including skipping', opts.length === 3 && opts.some(t => /skip/i.test(t)),
     opts.join(' | '));

  // ---------- skipping records nothing ----------
  const calls = [];
  await page.evaluate(() => {
    window.__punct = [];
    const real = api.ratePunctuality;
    api.ratePunctuality = (code, onTime, token) => { window.__punct.push({ code, onTime, token }); return Promise.resolve(); };
  });
  await page.locator('#punctOverlay button', { hasText: 'Skip this' }).click();
  await page.waitForTimeout(600);
  ok('Skip closes it', await page.locator('#punctOverlay.open').count() === 0);
  ok('Skip records no vote at all',
     await page.evaluate(() => window.__punct.length) === 0);
  ok('And the question is not asked again',
     await page.evaluate(() => localStorage.getItem('nearse_job_done_v1')) === null);

  // ---------- dismissing is a skip, not a black mark ----------
  await page.evaluate(() => {
    window.__punct = [];
    localStorage.setItem('nearse_job_done_v1', JSON.stringify({ code: 'ABCDEF0123', token: 'tok-1' }));
    maybeAskPunctuality();
  });
  await page.waitForTimeout(1700);
  await page.locator('#punctOverlay .close').click();
  await page.waitForTimeout(500);
  ok('Closing it with the X counts against nobody',
     await page.evaluate(() => window.__punct.length) === 0);

  await page.evaluate(() => {
    window.__punct = [];
    localStorage.setItem('nearse_job_done_v1', JSON.stringify({ code: 'ABCDEF0123', token: 'tok-1' }));
    maybeAskPunctuality();
  });
  await page.waitForTimeout(1700);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  ok('So does pressing Escape', await page.evaluate(() => window.__punct.length) === 0);

  // ---------- answering carries the job's own token ----------
  await page.evaluate(() => {
    window.__punct = [];
    localStorage.setItem('nearse_job_done_v1', JSON.stringify({ code: 'ABCDEF0123', token: 'tok-1' }));
    maybeAskPunctuality();
  });
  await page.waitForTimeout(1700);
  await page.locator('#punctOverlay button', { hasText: 'No, they were late' }).click();
  await page.waitForTimeout(600);
  const rec = await page.evaluate(() => window.__punct);
  ok('A real answer is recorded', rec.length === 1 && rec[0].onTime === false, JSON.stringify(rec[0] || null));
  ok('…and carries the job token, so a guessed code cannot vote',
     rec[0] && rec[0].token === 'tok-1');

  // a code stored before tokens existed still parses
  await page.evaluate(() => localStorage.setItem('nearse_job_done_v1', 'OLDCODE123'));
  ok('An old bare code is still understood',
     await page.evaluate(() => { const v = punctualityPending(); return v && v.code === 'OLDCODE123' && v.token === null; }));
  await page.evaluate(() => clearPunctuality());

  // ---------- worker calls send the session token, not the PIN ----------
  const sent = [];
  await page.evaluate(() => {
    window.__bodies = [];
    LIVE = true;              // a top-level `let`, so not a window property
    window.fetch = async (url, opts) => {
      window.__bodies.push({ url: String(url), body: opts && opts.body ? String(opts.body) : '' });
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    session = { phone: '9435012345', pin: '4321', name: 'T', registered: true, token: 'sess-token-1' };
  });
  await page.evaluate(async () => {
    await api.myOffers(session.phone, session.pin).catch(()=>{});
    await api.setOnline(session.phone, session.pin, 240).catch(()=>{});
    await api.myAppointments(session.phone, session.pin).catch(()=>{});
    await api.declineOffer(session.phone, session.pin, 'X').catch(()=>{});
  });
  const bodies = await page.evaluate(() => window.__bodies);
  const worker = bodies.filter(x => /my_offers|set_online|my_appointments|decline_offer/.test(x.url));
  ok('Every polled worker call was made', worker.length === 4, worker.length + ' calls');
  ok('None of them sends the PIN', worker.every(x => !/"p_pin"/.test(x.body)),
     worker.map(x => x.url.split('/').pop()).join(', '));
  ok('All of them send the session token', worker.every(x => /"p_token":"sess-token-1"/.test(x.body)));

  // without a token it falls back to the PIN, so an older device still works
  await page.evaluate(() => { window.__bodies = []; session.token = null; });
  await page.evaluate(async () => { await api.myOffers(session.phone, session.pin).catch(()=>{}); });
  const fb = await page.evaluate(() => window.__bodies);
  ok('A device with no session still signs in with its PIN',
     fb.length === 1 && /"p_pin":"4321"/.test(fb[0].body));

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
