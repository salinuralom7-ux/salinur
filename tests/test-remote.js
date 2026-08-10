/* Remote trades, the enlarged editing catalogue, and the booking reaching the
   worker on WhatsApp as well as inside Repto. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8827);
const ok = (label, cond, extra) =>
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8827/');
  await p.waitForTimeout(900);

  // ---------- the catalogue ----------
  const cat = await p.evaluate(() => ({
    total: SKILLS.length,
    cats: CATALOGUE.length,
    editing: (CATALOGUE.find(c => c[0] === 'edit') || [,,[]])[2].map(x => x[0]),
    remote: REMOTE_SKILLS.size,
    everySkillBanded: SKILLS.every(s => !!RATE_BAND[s.n]),
    everyRemoteReal: [...REMOTE_SKILLS].every(n => SKILLS.some(s => s.n === n))
  }));
  ok('Video Editor was already listed', cat.editing.includes('Video Editor'));
  ok('And now has company', cat.editing.length >= 10, cat.editing.length + ' editing trades');
  ok('  ' + cat.editing.join(', '), true);
  ok('Every skill still has a price band', cat.everySkillBanded);
  ok('Every remote trade is a real skill', cat.everyRemoteReal);
  ok('Remote trades marked', cat.remote >= 25, cat.remote);
  ok('Catalogue grew', cat.total >= 180, cat.total + ' services in ' + cat.cats + ' categories');

  // ---------- registering for remote work ----------
  await p.evaluate(() => {
    session = { phone: '9435012399', pin: '1234', name: 'Ankit Editor', registered: false };
    saveSession(); go('register');
  });
  await p.waitForTimeout(700);
  ok('City starts locked to Guwahati',
     await p.locator('#regCity').getAttribute('readonly') !== null &&
     await p.locator('#regCity').inputValue() === 'Guwahati');

  await p.evaluate(() => { picked = ['YouTube Video Editor']; renderPicked(); paintCityField(); });
  await p.waitForTimeout(400);
  ok('Picking a remote trade unlocks the city',
     await p.locator('#regCity').getAttribute('readonly') === null);
  ok('…and says why',
     (await p.locator('#regCityNote').innerText()).toLowerCase().includes('anywhere in india'));
  ok('…and locality stops being required',
     (await p.locator('#regAreaNote').innerText()).toLowerCase().includes('optional'));

  await p.evaluate(() => { picked = ['YouTube Video Editor', 'Electrician']; renderPicked(); paintCityField(); });
  await p.waitForTimeout(400);
  ok('Adding a doorstep trade locks it back to Guwahati',
     await p.locator('#regCity').getAttribute('readonly') !== null &&
     await p.locator('#regCity').inputValue() === 'Guwahati');
  ok('…and explains the rule',
     (await p.locator('#regCityNote').innerText()).toLowerCase().includes('guwahati only'));

  // ---------- a remote worker shows up without a distance ----------
  const code = await p.evaluate(async () => {
    const all = demoAll();
    const w = { ...all[0], id: 'remote-1', phone: '9435012399', pin: '1234', name: 'Ankit Editor',
                city: 'Silchar', area: null, serves_remote: true, status: 'approved', verified: true,
                worker_code: demoCode(),
                skills: [{ skill: 'YouTube Video Editor', price: 3000, unit: 'per job', exp: '4 years' }] };
    all.unshift(w); demoSave(all);
    session = null; saveSession();
    go('hire');
    return w.worker_code;
  });
  await p.waitForTimeout(1000);
  await p.fill('#hireSearch', 'YouTube');
  await p.waitForTimeout(700);
  ok('The Silchar editor is findable from Guwahati', await p.locator('.wcard').count() >= 1);
  const card = await p.locator('.wcard').first().innerText();
  ok('The card says they work remotely', card.includes('Works remotely'), card.replace(/\n/g, ' / '));
  ok('…and shows no invented distance', !/away/.test(card));
  ok('…but does name their city', card.includes('Silchar'));

  // ---------- booking reaches WhatsApp as well as Repto ----------
  const started = await p.evaluate(async () => {
    const w = demoAll().find(x => x.id === 'remote-1');
    const r = await api.startThread({ workerId: w.id, skill: 'YouTube Video Editor', name: 'Priya Das',
      phone: '9876543210', area: 'Six Mile', detail: 'Two reels', note: 'Wedding highlights',
      price: 3000, unit: 'per job', mode: 'hire' });
    rememberBooking({ code: r.code, token: r.token, worker: w.name, skill: 'YouTube Video Editor',
                      at: new Date().toISOString(), workerPhone: w.phone, detail: 'Two reels' });
    await openChat(r.code, 'customer', 'hire');
    return r.code;
  });
  await p.waitForTimeout(1200);
  ok('The request opens inside Repto', await p.locator('#scr-chat.on').count() === 1);
  ok('A WhatsApp nudge is offered while it is unanswered',
     await p.locator('.chat-nudge').count() === 1);
  ok('…and it explains what each one does',
     (await p.locator('#chatActions').innerText()).toLowerCase().includes('buzz'));

  const link = await p.evaluate(() => {
    let captured = null;
    const real = window.open;
    window.open = (u) => { captured = u; return null; };
    nudgeWhatsApp();
    window.open = real;
    return captured;
  });
  ok('The nudge targets the worker on WhatsApp', /^https:\/\/wa\.me\/919435012399/.test(link || ''), (link||'').slice(0, 46));
  const msg = decodeURIComponent((link || '').split('?text=')[1] || '');
  ok('It says a request is waiting for confirmation', /waiting for you to confirm/i.test(msg));
  ok('It carries the service', msg.includes('YouTube Video Editor'));
  ok('It carries the request code', msg.includes(started));
  ok('It links back into Repto rather than replacing it', msg.includes('#job=' + started));

  // ---------- that link opens the request for the worker ----------
  const worker = await ctx.newPage();
  worker.on('pageerror', e => errors.push('worker: ' + e.message));
  await worker.goto('http://localhost:8827/');
  await worker.waitForTimeout(800);
  await worker.evaluate(() => {
    const w = demoAll().find(x => x.id === 'remote-1');
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession();
  });
  await worker.goto('http://localhost:8827/#job=' + started);
  await worker.waitForTimeout(1400);
  ok('The worker lands straight on the request', await worker.locator('#scr-chat.on').count() === 1);
  ok('…with Accept in front of them',
     (await worker.locator('#chatActions').innerText()).includes('Accept'));

  // ---------- and it is visible without following a link ----------
  await worker.evaluate(() => go('home'));
  await worker.waitForTimeout(500);
  await worker.evaluate(() => checkPending(false));
  await worker.waitForTimeout(600);
  /* The landing card that carried this count is gone. The count rides the
     Bookings tab now, which is on every screen rather than only the home one. */
  ok('The tab bar counts what is waiting',
     await worker.locator('#tabBookingsN').isVisible(),
     await worker.locator('#tabBookingsN').innerText().catch(() => 'hidden'));

  ok('No JS errors anywhere', errors.length === 0, errors.join(' | ') || 'none');
  await browser.close(); srv.close();
})();
