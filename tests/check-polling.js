/* The offer poller is the busiest loop in the app — every second while an
   offer is live. It must not run with the app in the background, and it must
   stop when the "available right now" switch lapses. Both were true of the
   chat poller and not of this one. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8825);
const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8825/');
  await p.waitForTimeout(1000);

  // an online worker whose trade takes instant jobs
  await p.evaluate(() => {
    const all = demoAll();
    const w = all.find(x => (x.skills || []).some(s => modeOf(s.skill) === 'now')) || all[0];
    w.skills = [{ skill: 'Electrician', price: 400, unit: 'per visit', exp: '5 years' }];
    w.online_until = new Date(Date.now() + 60 * 60000).toISOString();
    w.status = 'approved'; w.verified = true;
    demoSave(all);
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession();
    // count the polls rather than the renders
    window.__polls = 0;
    const real = api.myOffers.bind(api);
    api.myOffers = async (...a) => { window.__polls++; return real(...a); };
    go('me');
  });
  await p.waitForTimeout(1500);
  const started = await p.evaluate(() => window.__polls);
  ok('An online worker polls for offers', started > 0, started + ' polls');

  // ---------- backgrounded ----------
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.__polls = 0;
  });
  await p.waitForTimeout(9000);          // ~2 polls at 5s, ~9 at 1s, 0 if fixed
  const hidden = await p.evaluate(() => window.__polls);
  ok('It stops while the app is in the background', hidden === 0, hidden + ' polls in 9s');

  // ---------- brought forward again ----------
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    window.__polls = 0;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForTimeout(2000);
  const back = await p.evaluate(() => window.__polls);
  ok('It catches up the moment the app comes forward', back > 0, back + ' polls');

  /* Being "available right now" only puts a worker first in the queue — the
     candidate query ranks by it, it does not filter by it — so a worker with
     the switch off is still offered work and must still see it. An earlier
     version of this fix gated polling on the switch and would have starved
     exactly those workers. */
  await p.evaluate(() => {
    session.worker.online_until = new Date(Date.now() - 1000).toISOString();
    saveSession();
    window.__polls = 0;
  });
  await p.waitForTimeout(6000);
  const lapsed = await p.evaluate(() => window.__polls);
  ok('A worker with the switch off still receives offers', lapsed > 0, lapsed + ' polls in 6s');

  // ---------- the chat poller already behaved; check it still does ----------
  await p.evaluate(() => {
    window.__chat = 0;
    const real = refreshChat;
    window.refreshChat = (...a) => { window.__chat++; return real(...a); };
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    startChatPolling();
  });
  await p.waitForTimeout(9000);
  ok('The chat poller also idles in the background',
     await p.evaluate(() => window.__chat) === 0);
  await p.evaluate(() => stopChatPolling());

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
