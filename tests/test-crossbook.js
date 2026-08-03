/* Two things a person hit on their own phone.

   One: a worker who wants to book somebody. An electrician needs a doctor.
   Being listed on MySheher should not mean signing up a second time to use
   it — the worker profile already holds a verified name, a verified number
   and a locality, which is more than a customer account holds.

   Two: a button that said WhatsApp and opened the app's own chat. The chat is
   the right place, so the label moved to match the behaviour rather than the
   other way round — and the WhatsApp option that genuinely exists had to be
   made to work, because it was offered at exactly the moment it could not. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8853);

let failed = 0;
const ok = (label, cond, extra) => {
  if (!cond) failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));
};
const screen = p => p.evaluate(() => (document.querySelector('.screen.on') || {}).id);

/* Sign in as a worker, using the demo store the preview mode already keeps. */
const beWorker = (p, i = 0) => p.evaluate(i => {
  localStorage.setItem('repto_account_asked_v1', '1');
  const w = demoAll()[i];
  customer = null; saveCustomer();
  session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
  saveSession();
  return { id: w.id, name: w.name, phone: w.phone, area: w.area };
}, i);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8853' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8853/'); await p.waitForTimeout(1200);

  // ---------- a worker is already an account ----------
  const me = await beWorker(p, 0);
  ok('Signed in as a worker, with no customer account',
     await p.evaluate(() => !signedIn() && workerSignedIn()));
  ok('…they may book', await p.evaluate(() => canBook()) === true);
  ok('…and are not pestered to sign up for one', await p.evaluate(async () => {
    accountOfferRetried = false;
    localStorage.removeItem('repto_account_asked_v1');
    go('home'); maybeOfferAccount();
    await new Promise(r => setTimeout(r, 300));
    return document.getElementById('accountOverlay').classList.contains('open');
  }) === false);

  // booking somebody else goes straight through
  const booked = await p.evaluate(async myId => {
    const other = demoAll().find(w => w.id !== myId);
    openBookingFor(other, 0);
    await new Promise(r => setTimeout(r, 400));
    const open = [...document.querySelectorAll('.overlay.open')].map(o => o.id);
    return { screen: (document.querySelector('.screen.on') || {}).id, open, other: other.name };
  }, me.id);
  ok('A worker booking somebody else is not stopped',
     booked.screen !== 'scr-account', booked.screen);
  ok('…the booking sheet opens', booked.open.length === 1, booked.open.join(',') || 'none');

  // and it is filled in from the profile they already have
  const filled = await p.evaluate(() => {
    const ids = [['nowName','nowPhone','nowArea'],['slotName','slotPhone',null],
                 ['bookName','bookPhone','bookArea']];
    for (const [n, ph, a] of ids) {
      const el = document.getElementById(n);
      if (el && el.offsetParent !== null)
        return { name: el.value, phone: document.getElementById(ph).value,
                 area: a ? document.getElementById(a).value : null };
    }
    return null;
  });
  ok('…carrying their own name from the worker profile',
     filled && filled.name === me.name, filled && filled.name);
  ok('…and their number', filled && filled.phone === me.phone, filled && filled.phone);

  // but not themselves
  const self = await p.evaluate(async myId => {
    closeModal([...document.querySelectorAll('.overlay.open')].map(o => o.id)[0] || 'bookOverlay');
    await new Promise(r => setTimeout(r, 250));
    const mine = demoAll().find(w => w.id === myId);
    openBookingFor(mine, 0);
    await new Promise(r => setTimeout(r, 350));
    return [...document.querySelectorAll('.overlay.open')].map(o => o.id);
  }, me.id);
  ok('A worker cannot book themselves', self.length === 0, self.join(',') || 'nothing opened');

  // ---------- a customer with no worker profile is still asked ----------
  await p.evaluate(() => {
    session = null; try { localStorage.removeItem(SSTORE); } catch (e) {}
    customer = null; saveCustomer();
  });
  const stranger = await p.evaluate(async () => {
    openBookingFor(demoAll()[0], 0);
    await new Promise(r => setTimeout(r, 400));
    return (document.querySelector('.screen.on') || {}).id;
  });
  ok('Somebody with neither is still asked for an account',
     stranger === 'scr-account', stranger);

  // ---------- the button says what it does ----------
  /* Matched on the button, not the file — the comment above it quotes the old
     label on purpose, and a bare search finds that too. */
  ok('The booking button no longer promises WhatsApp',
     !/<button[^>]*id="confirmBookBtn"[^>]*>[^<]*WhatsApp/.test(html));
  ok('…it says what it is', /id="confirmBookBtn"[^>]*>Send request</.test(html));
  ok('…and says where the request goes',
     /Opens a conversation inside MySheher/.test(html));
  ok('The landing strip no longer says a request lands on WhatsApp',
     !/Lands on their WhatsApp/.test(html));

  // ---------- an appointment behaves like every other booking ----------
  ok('Confirming an appointment no longer hijacks the tab to WhatsApp',
     !/const tab = window\.open\("", "_blank"\)/.test(html));
  ok('…it opens the conversation instead',
     /mode:"slot" \}\);/.test(html) && /openChat\(started\.code, "customer", "hire"\)/.test(html));

  await p.evaluate(() => { localStorage.setItem('repto_account_asked_v1', '1'); });
  const appt = await beWorker(p, 0).then(() => p.evaluate(async () => {
    const w = demoAll().find(x => x.id !== session.worker.id);
    w.skills = [{ skill: 'Dentist', price: 500, unit: 'per session' }];
    w.availability = { days: [0,1,2,3,4,5,6], from: '10:00', to: '13:00', len: 30 };
    currentWorker = w; bookPick = { svc: 0 };
    const d = new Date(); d.setDate(d.getDate() + 1);
    slotPick = { date: d.toISOString().slice(0,10), time: '11:00', taken: [] };
    document.getElementById('slotName').value  = 'Rahim Ali';
    document.getElementById('slotPhone').value = '9876500111';
    document.getElementById('slotNote').value  = 'Tooth ache';
    let opened = null;
    const realOpen = window.open;
    window.open = (...a) => { opened = a[0]; return null; };
    await confirmSlot();
    await new Promise(r => setTimeout(r, 900));
    window.open = realOpen;
    return { opened, screen: (document.querySelector('.screen.on') || {}).id,
             saved: myBookings().length };
  }));
  ok('Booking an appointment does not throw them into WhatsApp',
     appt.opened === null, String(appt.opened));
  ok('…it lands them in the conversation', appt.screen === 'scr-chat', appt.screen);
  ok('…and the appointment is kept with their other bookings', appt.saved > 0, appt.saved);

  // ---------- and the WhatsApp nudge that does exist, works ----------
  /* It is offered while the request is still unanswered, and thread_view
     withholds the worker's number until it is accepted — so this button used
     to fail every time it was most useful. */
  const nudge = await p.evaluate(async () => {
    let opened = null;
    const realOpen = window.open;
    window.open = (u) => { opened = u; return null; };
    chatThread = { code: 'ZZ1', status: 'requested', skill: 'Dentist',
                   worker_id: demoAll()[1].id, worker_name: demoAll()[1].name,
                   worker_phone: null };            // exactly what the server sends
    chatCode = 'ZZ1';
    await nudgeWhatsApp();
    await new Promise(r => setTimeout(r, 400));
    window.open = realOpen;
    return opened;
  });
  ok('The WhatsApp nudge opens WhatsApp even before the job is accepted',
     /^https:\/\/wa\.me\/91\d{10}/.test(nudge || ''), nudge);
  ok('…carrying the request in the message', /MySheher/.test(decodeURIComponent(nudge || '')));

  ok('No JS errors', errs.length === 0, errs.join(' | ') || 'none');
  await b.close(); srv.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall green');
  process.exit(failed ? 1 : 0);
})();
