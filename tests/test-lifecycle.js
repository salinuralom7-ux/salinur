/* The loop the whole product turns on: a customer books, a worker accepts,
   works, finishes, the customer confirms and reviews. Driven from both sides
   in preview mode, checking at every step that the screen says what is
   happening and offers a way forward. A dead end here is worse than a bug. */
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
}).listen(8822);

const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];

  // ---- the customer, and the worker, in two tabs, sharing one preview store ----
  const cust = await ctx.newPage();
  cust.on('pageerror', e => errors.push('customer: ' + e.message));
  await cust.goto('http://localhost:8822/'); await cust.waitForTimeout(1200);

  const seeded = await cust.evaluate(() => {
    const w = demoAll().find(x => (x.skills || []).some(s => s.skill === 'Plumber')) || demoAll()[0];
    const t = demoStartThread({ workerId: w.id, skill: w.skills[0].skill, mode: 'appointment',
      detail: 'Tomorrow morning', name: 'Priya Das', phone: '9876543210', area: 'Six Mile',
      price: w.skills[0].price, unit: w.skills[0].unit, note: 'Kitchen tap is leaking' });
    rememberBooking({ code: t.code, token: t.token, worker_name: t.worker_name,
                      skill: w.skills[0].skill, created_at: new Date().toISOString() });
    return { code: t.code, worker: t.worker_name, workerId: w.id,
             phone: w.phone, pin: w.pin, skill: w.skills[0].skill };
  });
  console.log('      booked ' + seeded.skill + ' with ' + seeded.worker + ' (' + seeded.code + ')\n');

  const state = p => p.evaluate(() => chatThread && chatThread.status);
  const actions = async p => (await p.locator('#chatActions').innerText()).replace(/\s+/g, ' ').trim();
  const canType = p => p.evaluate(() => !document.getElementById('chatInput').disabled);

  // ---------- the customer waits ----------
  await cust.evaluate(c => openChat(c, 'customer', 'chats'), seeded.code);
  await cust.waitForTimeout(1000);
  ok('Customer lands in the conversation', await cust.evaluate(() =>
     (document.querySelector('.screen.on') || {}).id) === 'scr-chat');
  ok('It is titled with the worker', (await cust.locator('#chatTitle').innerText()).includes(seeded.worker));
  ok('The state is named, not left blank', (await cust.locator('#chatState').innerText()).trim().length > 0,
     (await cust.locator('#chatState').innerText()).trim());
  ok('The request itself is in the log',
     (await cust.locator('#chatLog').innerText()).includes('Priya Das'));
  ok('Customer can write while waiting', await canType(cust));

  // ---------- the worker sees it ----------
  const work = await ctx.newPage();
  work.on('pageerror', e => errors.push('worker: ' + e.message));
  await work.goto('http://localhost:8822/'); await work.waitForTimeout(1200);
  // every preview worker shares one phone number, so sign-in would pick the
  // wrong one; point the session straight at the worker who was booked
  await work.evaluate(({ workerId }) => {
    const w = demoAll().find(x => x.id === workerId);
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession();
  }, seeded);
  await work.evaluate(() => go('inbox')); await work.waitForTimeout(1000);
  ok('It is waiting in the worker\'s inbox', await work.locator('.thread-row').count() >= 1,
     await work.locator('.thread-row').count() + ' rows');
  ok('Marked unread for the worker', await work.locator('.thread-row.unread').count() >= 1);

  await work.locator('.thread-row').first().click(); await work.waitForTimeout(1000);
  ok('Worker opens it', await state(work) === 'requested', await state(work));
  let a = await actions(work);
  ok('Worker is offered accept and decline', /Accept this job/i.test(a) && /take it/i.test(a), a);
  ok('The listed rate is shown to the worker', /₹/.test(a), a.match(/Listed at [^ ]+ [^ ]+/) ? a.match(/Listed at [^A-Z]+/)[0].trim() : '—');

  // ---------- accept → start → finish ----------
  await work.locator('#chatActions button', { hasText: 'Accept this job' }).click();
  await work.waitForTimeout(1000);
  ok('Accepting moves the state on', await state(work) === 'accepted', await state(work));
  a = await actions(work);
  ok('Next step is offered, not guessed at', /started/i.test(a), a);
  ok('Worker can now reach the customer by phone', /call/i.test(a) || /9876543210/.test(a), a);

  await work.locator('#chatActions button', { hasText: "I've started" }).click();
  await work.waitForTimeout(900);
  ok('Started', await state(work) === 'working', await state(work));
  ok('And the way to finish is offered', /Mark finished/i.test(await actions(work)));

  await work.locator('#chatActions button', { hasText: 'Mark finished' }).click();
  await work.waitForTimeout(900);
  ok('Worker marks it finished', await state(work) === 'done', await state(work));
  a = await actions(work);
  ok('Worker is told what happens next, not left blank', /confirm/i.test(a), a);

  // ---------- the customer sees each change without touching anything ----------
  await cust.waitForTimeout(4800);        // the four-second poll
  ok('Customer sees it without reloading', await state(cust) === 'done', await state(cust));
  const log = await cust.locator('#chatLog').innerText();
  ok('Every step was narrated in the conversation',
     /accepted this job/i.test(log) && /started work/i.test(log) && /finished/i.test(log));
  a = await actions(cust);
  ok('Customer is asked to confirm', /confirm|finished/i.test(a), a);

  // ---------- confirm and review ----------
  const confirmBtn = cust.locator('#chatActions button').first();
  await confirmBtn.click(); await cust.waitForTimeout(1200);
  ok('Confirming closes the job', await state(cust) === 'closed', await state(cust));
  ok('A closed conversation cannot be typed in', await canType(cust) === false);
  ok('The box says why it is closed',
     (await cust.locator('#chatInput').getAttribute('placeholder') || '').toLowerCase().includes('closed'));
  a = await actions(cust);
  ok('A review is invited once it is over', /review|star|rate/i.test(a), a || '(nothing offered)');

  // the app opens the review sheet itself the moment the job closes, rather
  // than waiting to be asked — so it should already be up
  ok('The review sheet opens on its own', await cust.locator('#reviewOverlay.open').count() === 1);
  {
    const sheet = await cust.locator('.overlay.open').count();
    ok('Exactly one sheet is up', sheet === 1);
    const stars = cust.locator('.overlay.open [data-s="5"], .overlay.open .pick-stars span').last();
    if (await stars.count()) { await stars.click(); await cust.waitForTimeout(200); }
    const send = cust.locator('.overlay.open .btn-brand').first();
    if (await send.count()) { await send.click(); await cust.waitForTimeout(1200); }
    ok('The review is recorded against the worker', await cust.evaluate(c => {
      const t = allThreads().find(x => x.code === c);
      return !!(t && t.reviewed);
    }, seeded.code));
  }

  // ---------- neither side is left stranded ----------
  await work.evaluate(() => refreshChat(true)); await work.waitForTimeout(900);
  ok('Worker sees the closed state too', await state(work) === 'closed', await state(work));
  ok('Worker cannot type into a closed job', await canType(work) === false);
  await work.locator('.chat-back').click(); await work.waitForTimeout(700);
  ok('Back out of a closed job goes somewhere real', await work.evaluate(() =>
     (document.querySelector('.screen.on') || {}).id), await work.evaluate(() =>
     (document.querySelector('.screen.on') || {}).id));

  // the finished job shows up under the right heading, not lost
  await work.evaluate(() => { inboxTab = 'done'; go('inbox'); }); await work.waitForTimeout(1000);
  ok('A finished job is filed under Completed', await work.locator('.thread-row').count() >= 1,
     await work.locator('.thread-row').count() + ' rows');

  ok('No JS errors on either side', errors.length === 0, errors.join(' | ') || 'none');
  await cust.screenshot({ path: __dirname + '/shots/lifecycle-customer.png' });
  await b.close(); srv.close();
})();
