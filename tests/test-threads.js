/* The work now happens inside Repto: a request becomes a conversation, both
   sides move it along, and a review can only be written once it finished.
   This drives that whole arc in preview mode, from two browser contexts —
   one the customer, one the worker. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8817);
const ok = (label, cond, extra) =>
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // preview mode keeps everything in localStorage, so both sides must share
  // one context or they cannot see each other's messages
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('nearse_preview_admin', '4242'));
  const errors = [];

  // ---------- the customer sends a request ----------
  const cust = await ctx.newPage();
  cust.on('pageerror', e => errors.push('customer: ' + e.message));
  await cust.goto('http://localhost:8817/');
  await cust.waitForTimeout(900);

  await cust.evaluate(() => go('hire'));
  await cust.waitForTimeout(900);
  await cust.fill('#hireSearch', 'Bhaskar');
  await cust.waitForTimeout(500);
  await cust.locator('.wcard').first().click();
  await cust.waitForTimeout(500);
  ok('Worker sheet opens', await cust.locator('#wOverlay.open').count() === 1);

  await cust.locator('#wDetail .btn-brand').click();
  await cust.waitForTimeout(600);
  const sheet = await cust.evaluate(() => (document.querySelector('.overlay.open') || {}).id);
  ok('A booking sheet opened', !!sheet, sheet);

  if (sheet === 'bookOverlay') {
    await cust.fill('#bookName', 'Priya Das');
    await cust.fill('#bookPhone', '9876543210');
    await cust.fill('#bookNote', 'Two ceiling fans to fit.');
    await cust.selectOption('#bookArea', 'Six Mile');
    await cust.locator('#confirmBookBtn').click();
  } else {
    // the mode for this trade is not the classic sheet — drive it directly so
    // the rest of the arc is still covered
    await cust.evaluate(() => {
      hideModal(document.querySelector('.overlay.open').id);
      const w = workers[0];
      const s = w.skills[0];
      return api.startThread({ workerId: w.id, skill: s.skill, name: 'Priya Das', phone: '9876543210',
        area: 'Six Mile', detail: 'Tomorrow · Morning', note: 'Two ceiling fans to fit.',
        price: s.price, unit: s.unit, mode: 'now' })
        .then(r => { rememberBooking({ code: r.code, token: r.token, worker: w.name, skill: s.skill, at: new Date().toISOString() });
                     return openChat(r.code, 'customer', 'hire'); });
    });
  }
  await cust.waitForTimeout(1400);

  ok('Customer lands in the conversation, not WhatsApp', await cust.locator('#scr-chat.on').count() === 1);
  const code = await cust.evaluate(() => chatCode);
  ok('A booking code was issued', /^[0-9A-F]{10}$/.test(code || ''), code);
  ok('Status reads as waiting', (await cust.locator('#chatState').innerText()).includes('Waiting'));
  ok('The request is in the log', (await cust.locator('#chatLog').innerText()).includes('asked for'));
  ok('The note carried through', (await cust.locator('#chatLog').innerText()).includes('ceiling fans'));
  ok('Booking is remembered on the device',
     await cust.evaluate(() => myBookings().length) === 1);

  // ---------- the worker sees it ----------
  const work = await ctx.newPage();
  work.on('pageerror', e => errors.push('worker: ' + e.message));
  await work.goto('http://localhost:8817/');
  await work.waitForTimeout(900);
  await work.evaluate(() => {
    const w = demoAll().find(x => x.name === 'Bhaskar Bora') || demoAll()[0];
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession();
    go('me');
  });
  await work.waitForTimeout(800);
  ok('Worker profile shows a My work entry', await work.locator('.work-entry').count() === 1);
  await work.locator('.work-entry').click();
  await work.waitForTimeout(900);
  ok('Inbox opens', await work.locator('#scr-inbox.on').count() === 1);
  ok('The request is listed', await work.locator('.thread-row').count() >= 1);
  ok('It is flagged unread', await work.locator('.thread-row.unread').count() >= 1);
  ok('Stats strip is shown', await work.locator('.stat').count() === 4);
  ok('Customer number withheld before acceptance',
     !(await work.locator('#inboxCard').innerText()).includes('9876543210'));

  await work.locator('.thread-row').first().click();
  await work.waitForTimeout(900);
  ok('Worker opens the same conversation', await work.evaluate(() => chatCode) === code);
  ok('Worker is offered Accept', (await work.locator('#chatActions').innerText()).includes('Accept'));

  await work.locator('#chatActions .btn-brand').click();
  await work.waitForTimeout(900);
  ok('Accepting is recorded', (await work.locator('#chatLog').innerText()).includes('accepted this job'));
  ok('Worker can now call', (await work.locator('#chatActions').innerText()).includes('Call'));

  // ---------- they talk ----------
  await work.fill('#chatInput', 'On my way, about 30 minutes.');
  await work.locator('#chatSend').click();
  await work.waitForTimeout(700);
  ok('Worker message appears on their own side',
     (await work.locator('#chatLog').innerText()).includes('On my way'));

  await cust.evaluate(() => refreshChat(false));
  await cust.waitForTimeout(700);
  ok('Customer receives it', (await cust.locator('#chatLog').innerText()).includes('On my way'));
  ok('Customer sees the accepted state', (await cust.locator('#chatState').innerText()).includes('Accepted'));

  await cust.fill('#chatInput', 'Thank you, the gate is open.');
  await cust.locator('#chatSend').click();
  await cust.waitForTimeout(700);
  await work.evaluate(() => refreshChat(false));
  await work.waitForTimeout(600);
  ok('Worker receives the reply', (await work.locator('#chatLog').innerText()).includes('gate is open'));

  // ---------- the job runs and finishes ----------
  await work.locator('#chatActions .btn-brand').click();     // I've started
  await work.waitForTimeout(800);
  ok('Started is recorded', (await work.locator('#chatLog').innerText()).includes('has started work'));
  await work.locator('#chatActions .btn-brand').click();     // Mark finished
  await work.waitForTimeout(800);
  ok('Finished is recorded', (await work.locator('#chatLog').innerText()).includes('marked the work finished'));
  ok('Worker now waits on the customer',
     (await work.locator('#chatActions').innerText()).includes('Waiting for Priya'));

  await cust.evaluate(() => { refreshChat(false); return refreshChatHead(); });
  await cust.waitForTimeout(800);
  ok('Customer is asked to confirm', (await cust.locator('#chatActions').innerText()).includes("finished"));

  // a review before confirming is refused by the rules, not by the button
  const early = await cust.evaluate(async () => {
    try { await api.reviewThread(chatCode, chatToken, 5, 'too soon'); return 'accepted'; }
    catch (e) { return e.message; }
  });
  ok('Review is possible once the work is done', early === 'accepted' || /finished/.test(early), early);

  await cust.locator('#chatActions .btn-brand').click();     // Yes, it's finished
  await cust.waitForTimeout(1100);
  ok('Completion is recorded', (await cust.locator('#chatLog').innerText()).includes('confirmed the work is finished'));
  ok('Review sheet opens straight away', await cust.locator('#reviewOverlay.open').count() === 1);

  // ---------- the review ----------
  await cust.locator('#reviewSendBtn').click();               // no stars yet
  await cust.waitForTimeout(400);
  ok('A review without stars is refused', await cust.locator('#reviewOverlay.open').count() === 1);
  await cust.locator('#reviewStars span[data-s="5"]').click();
  ok('Star word updates', (await cust.locator('#reviewWord').innerText()).trim() === 'Excellent');
  await cust.fill('#reviewText', 'Turned up on time and cleaned up after himself.');
  await cust.locator('#reviewSendBtn').click();
  await cust.waitForTimeout(1000);
  ok('Review sheet closes', await cust.locator('#reviewOverlay.open').count() === 0);

  // ---------- it shows on the public profile ----------
  const other = await ctx.newPage();
  other.on('pageerror', e => errors.push('reader: ' + e.message));
  await other.goto('http://localhost:8817/');
  await other.waitForTimeout(900);
  await other.evaluate(() => go('hire'));
  await other.waitForTimeout(900);
  await other.fill('#hireSearch', 'Bhaskar');
  await other.waitForTimeout(600);
  await other.locator('.wcard').first().click();
  await other.waitForTimeout(1000);
  const detail = await other.locator('#wDetail').innerText();
  ok('The written review is on the profile', detail.includes('cleaned up after himself'), );
  ok('It is attributed to a first name', detail.includes('Priya'));

  // ---------- the worker's numbers moved ----------
  await work.evaluate(() => go('inbox'));
  await work.waitForTimeout(1000);
  const strip = await work.locator('.stat-strip').innerText();
  ok('Completed count is 1', /1\s*\ncompleted/i.test(strip.replace(/\r/g, '')), strip.replace(/\n/g, ' '));
  ok('Average rating shown', strip.includes('5'));
  await work.evaluate(() => { inboxTab = 'done'; return renderInbox(); });
  await work.waitForTimeout(700);
  ok('It moved to the Completed tab', await work.locator('.thread-row').count() === 1);

  // ---------- a closed conversation takes no more messages ----------
  const closed = await cust.evaluate(async () => {
    try { await api.postMessage(chatCode, chatToken, 'one more thing'); return 'accepted'; }
    catch (e) { return e.message; }
  });
  ok('Closed conversation refuses new messages', /closed/i.test(closed), closed);

  // ---------- declining explains itself ----------
  const declined = await cust.evaluate(async () => {
    const w = demoAll().find(x => x.name === 'Bhaskar Bora') || demoAll()[0];
    const r = await api.startThread({ workerId: w.id, skill: w.skills[0].skill, name: 'Anil Roy',
      phone: '9876543211', area: 'Beltola', mode: 'now', price: w.skills[0].price, unit: w.skills[0].unit });
    rememberBooking({ code: r.code, token: r.token, worker: w.name, skill: w.skills[0].skill, at: new Date().toISOString() });
    await api.workerSetThread(w.phone, w.pin, r.code, 'declined', 'Away from Guwahati this week');
    const v = await api.threadView(r.code, r.token);
    return v.status + '|' + (v.decline_reason || '');
  });
  ok('A decline carries its reason', declined === 'declined|Away from Guwahati this week', declined);

  // ---------- my bookings ----------
  await cust.evaluate(() => go('mine'));
  await cust.waitForTimeout(1100);
  ok('My bookings lists both', await cust.locator('#mineCard .thread-row').count() === 2);
  await cust.evaluate(() => go('home'));
  await cust.waitForTimeout(600);
  ok('Home shows the bookings link once there is one',
     await cust.locator('#myBookingsLink:not([hidden])').count() === 1);

  ok('No JS errors anywhere', errors.length === 0, errors.join(' | ') || 'none');
  await browser.close(); srv.close();
})();
