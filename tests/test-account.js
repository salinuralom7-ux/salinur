/* Customer accounts. Browsing stays open to anybody; booking does not.
   The whole point is that a person who is about to send their name, number
   and locality to a stranger has somewhere to see it, change it and delete
   it — so the gate, the profile and the deletion all matter equally. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8846);

let failed = 0;
const ok = (label, cond, extra) => {
  if (!cond) failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));
};
const screen = p => p.evaluate(() => (document.querySelector('.screen.on') || {}).id);

/* Which sheet a booking opens is decided by the service, not by the customer,
   and there are three of them. An earlier version of this file assumed the
   scheduled sheet and quietly tested one flow out of three — the first worker
   in the demo list happens to offer an instant trade, so #bookOverlay never
   opened and the account looked broken when it was not. Look the sheet up
   from the mode instead. */
const SHEET = {
  now:   { overlay: 'nowOverlay',  name: 'nowName',  phone: 'nowPhone',  area: 'nowArea'  },
  slot:  { overlay: 'slotOverlay', name: 'slotName', phone: 'slotPhone', area: null       },
  sched: { overlay: 'bookOverlay', name: 'bookName', phone: 'bookPhone', area: 'bookArea' },
  hire:  { overlay: 'bookOverlay', name: 'bookName', phone: 'bookPhone', area: 'bookArea' }
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8846' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8846/'); await p.waitForTimeout(1200);

  // ---------- browsing needs no account ----------
  await p.evaluate(() => go('hire')); await p.waitForTimeout(800);
  ok('Browsing works signed out', await screen(p) === 'scr-hire');
  await p.fill('#hireSearch', 'Bhaskar'); await p.waitForTimeout(500);
  await p.locator('.wcard').first().click(); await p.waitForTimeout(500);
  ok('A worker profile opens signed out', await p.locator('#wOverlay.open').count() === 1);

  // ---------- but booking does ----------
  await p.locator('#bookCta').click(); await p.waitForTimeout(700);
  ok('Booking signed out asks for an account', await screen(p) === 'scr-account', await screen(p));
  ok('…and says why', (await p.locator('#acctWhy').innerText()).toLowerCase().includes('account'));
  ok('The booking sheet did not open', await p.locator('#bookOverlay.open').count() === 0);

  // ---------- the sign-up form asks only what a booking needs ----------
  const fields = await p.evaluate(() =>
    [...document.querySelectorAll('#scr-account input, #scr-account select')]
      .filter(e => e.offsetParent !== null).map(e => e.id));
  ok('Only name, number, area and a PIN are asked for',
     JSON.stringify(fields) === JSON.stringify(['acctName','acctPhone','acctArea','acctPin']), fields.join(', '));

  // ---------- validation ----------
  await p.fill('#acctName', 'Priya Das');
  await p.fill('#acctPhone', '123'); await p.fill('#acctPin', '1234');
  await p.locator('#acctGoBtn').click(); await p.waitForTimeout(400);
  ok('A bad number is refused', await screen(p) === 'scr-account');
  await p.fill('#acctPhone', '9876500111'); await p.fill('#acctPin', '12');
  await p.locator('#acctGoBtn').click(); await p.waitForTimeout(400);
  ok('A short PIN is refused', await screen(p) === 'scr-account');

  // ---------- signing up returns to the booking that was interrupted ----------
  const sheet = SHEET[await p.evaluate(() => bookingModeFor(currentWorker))];
  await p.fill('#acctPin', '4321');
  await p.selectOption('#acctArea', 'Beltola');
  await p.locator('#acctGoBtn').click(); await p.waitForTimeout(1200);
  ok('Signing up opens the booking it interrupted',
     await p.locator(`#${sheet.overlay}.open`).count() === 1, await screen(p));
  ok('The name is already filled in',  await p.inputValue(`#${sheet.name}`)  === 'Priya Das');
  ok('…and the number',                await p.inputValue(`#${sheet.phone}`) === '9876500111');
  if (sheet.area)
    ok('…and the area',                await p.inputValue(`#${sheet.area}`)  === 'Beltola');
  await p.evaluate(o => closeModal(o), sheet.overlay); await p.waitForTimeout(300);

  /* Every mode, not just the one the first demo worker happens to use. The
     gate lives in openBookingFor, which all three pass through, so a mode
     that skipped it would be a stranger receiving a name and a number with
     nobody able to change or delete them afterwards. */
  const perMode = await p.evaluate(async sheets => {
    const out = {};
    for (const [mode, s] of Object.entries(sheets)) {
      const w = demoAll().find(x => (x.skills || []).some(k => modeOf(k.skill) === mode));
      if (!w) continue;
      const i = w.skills.findIndex(k => modeOf(k.skill) === mode);
      openBookingFor(w, i);
      await new Promise(r => setTimeout(r, 350));
      out[mode] = {
        opened: document.getElementById(s.overlay).classList.contains('open'),
        name:   (document.getElementById(s.name)  || {}).value,
        phone:  (document.getElementById(s.phone) || {}).value,
        area:   s.area ? (document.getElementById(s.area) || {}).value : null
      };
      closeModal(s.overlay);
      await new Promise(r => setTimeout(r, 120));
    }
    return out;
  }, SHEET);

  for (const [mode, r] of Object.entries(perMode)) {
    ok(`"${mode}" bookings open their own sheet`, r.opened === true);
    ok(`"${mode}" carries the name over`,   r.name === 'Priya Das', r.name);
    ok(`"${mode}" carries the number over`, r.phone === '9876500111', r.phone);
    if (r.area !== null)
      ok(`"${mode}" carries the area over`, r.area === 'Beltola', r.area);
  }

  // ---------- and signed out, every mode is stopped ----------
  const gated = await p.evaluate(async sheets => {
    const keep = localStorage.getItem('repto_customer_v1');
    const out = {};
    for (const [mode, s] of Object.entries(sheets)) {
      customer = null; localStorage.removeItem('repto_customer_v1');
      const w = demoAll().find(x => (x.skills || []).some(k => modeOf(k.skill) === mode));
      if (!w) continue;
      openBookingFor(w, w.skills.findIndex(k => modeOf(k.skill) === mode));
      await new Promise(r => setTimeout(r, 300));
      out[mode] = document.getElementById(s.overlay).classList.contains('open');
    }
    localStorage.setItem('repto_customer_v1', keep); loadCustomer();
    accountAfter = null; go('home');
    return out;
  }, SHEET);

  for (const [mode, opened] of Object.entries(gated))
    ok(`Signed out, a "${mode}" booking is stopped`, opened === false);

  // ---------- and it survives a reload ----------
  await p.reload(); await p.waitForTimeout(1400);
  ok('Still signed in after a reload', await p.evaluate(() => signedIn()));

  // ---------- my profile ----------
  await p.evaluate(() => go('profile')); await p.waitForTimeout(700);
  ok('My profile shows the name',   await p.inputValue('#pfName') === 'Priya Das');
  ok('…and the area',               await p.inputValue('#pfArea') === 'Beltola');
  ok('The number is shown but locked',
     await p.locator('#scr-profile input[disabled]').inputValue() === '9876500111');
  await p.fill('#pfName', 'Priya D');
  await p.locator('#pfSaveBtn').click(); await p.waitForTimeout(700);
  ok('Changes save', await p.evaluate(() => customer.name) === 'Priya D');

  // ---------- booking again asks for nothing ----------
  await p.evaluate(() => go('hire')); await p.waitForTimeout(700);
  await p.fill('#hireSearch', 'Bhaskar'); await p.waitForTimeout(500);
  await p.locator('.wcard').first().click(); await p.waitForTimeout(400);
  await p.locator('#bookCta').click(); await p.waitForTimeout(700);
  ok('Signed in, booking opens straight away',
     await p.locator(`#${sheet.overlay}.open`).count() === 1);
  ok('…carrying the updated name', await p.inputValue(`#${sheet.name}`) === 'Priya D');

  // ---------- the menu ----------
  await p.evaluate(o => closeModal(o), sheet.overlay); await p.waitForTimeout(300);
  await p.locator('#menuBtn').click(); await p.waitForTimeout(500);
  ok('The menu offers My profile', (await p.locator('#drawerProfileLabel').innerText()).trim() === 'My profile');

  // ---------- signing out, and deleting ----------
  await p.evaluate(() => { setMenu(false); go('profile'); }); await p.waitForTimeout(600);
  await p.evaluate(() => signOutCustomer()); await p.waitForTimeout(700);
  ok('Signing out clears the session', await p.evaluate(() => signedIn()) === false);
  await p.evaluate(() => go('profile')); await p.waitForTimeout(500);
  ok('The profile then offers a way back in',
     (await p.locator('#profileCard').innerText()).includes('not signed in'));

  await p.evaluate(async () => { await api.loginCustomer('9876500111','4321').then(t => {
    customer = { token: t }; saveCustomer(); }); });
  await p.evaluate(async () => { const me = await api.customerMe(customer.token);
    customer = { token: customer.token, ...me }; saveCustomer(); });
  ok('Signing back in with the same PIN works', await p.evaluate(() => customer.phone) === '9876500111');
  await p.evaluate(() => { go('profile'); deleteCustomerAccount(); }); await p.waitForTimeout(500);
  ok('Deleting asks first', await p.locator('#custDelOverlay.open').count() === 1);
  await p.locator('#custDelOverlay .btn-quiet').click(); await p.waitForTimeout(400);
  ok('…and backing out keeps the account', await p.evaluate(() => signedIn()) === true);
  await p.evaluate(() => deleteCustomerAccount()); await p.waitForTimeout(400);
  await p.locator('#custDelBtn').click(); await p.waitForTimeout(800);
  ok('Deleting removes the account', await p.evaluate(() => signedIn()) === false);
  ok('…and it really is gone',
     await p.evaluate(async () => (await api.loginCustomer('9876500111','4321')) === null));

  // ---------- the first-visit offer ----------
  const fresh = await b.newContext({ viewport: { width: 390, height: 844 } });
  await fresh.grantPermissions(['notifications'], { origin: 'http://localhost:8846' });
  const f = await fresh.newPage();
  await f.goto('http://localhost:8846/'); await f.waitForTimeout(6000);
  ok('A first-time visitor is offered an account', await f.locator('#accountOverlay.open').count() === 1);
  const offer = await f.locator('#accountOverlay').innerText();
  ok('…with "Skip for now" beside it', /skip for now/i.test(offer));
  /* Sign up has to actually go somewhere. It did not: closeModal queues a
     history.back() that fired after go("account") and undid it, so the button
     did nothing at all and left you on the home screen. Reported from a
     phone, and it happened every time — which is why it is driven here as a
     real tap rather than by calling the handler. */
  await f.locator('#accountOverlay .btn-brand').click(); await f.waitForTimeout(700);
  ok('Sign up on the offer opens the sign-up screen',
     await f.evaluate(() => (document.querySelector('.screen.on') || {}).id) === 'scr-account',
     await f.evaluate(() => (document.querySelector('.screen.on') || {}).id));
  ok('…and it stays there a moment later, rather than snapping back home',
     await f.evaluate(async () => { await new Promise(r => setTimeout(r, 900));
       return (document.querySelector('.screen.on') || {}).id; }) === 'scr-account');
  ok('…on the sign-up tab', await f.evaluate(() => acctMode) === 'signup');
  ok('…and the offer sheet is gone', await f.locator('#accountOverlay.open').count() === 0);

  /* back from there returns to where they were, not into the sheet again */
  await f.goBack(); await f.waitForTimeout(700);
  ok('Back from sign-up returns home, not into the offer',
     await f.evaluate(() => (document.querySelector('.screen.on') || {}).id) === 'scr-home',
     await f.evaluate(() => (document.querySelector('.screen.on') || {}).id));

  // and skipping, from a fresh visit
  const skipCtx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await skipCtx.grantPermissions(['notifications'], { origin: 'http://localhost:8846' });
  const sk = await skipCtx.newPage();
  await sk.goto('http://localhost:8846/'); await sk.waitForTimeout(6000);
  await sk.locator('#accountOverlay .btn-quiet').click(); await sk.waitForTimeout(400);
  ok('Skipping closes it', await sk.locator('#accountOverlay.open').count() === 0);
  await sk.reload(); await sk.waitForTimeout(6000);
  ok('…and it does not nag again', await sk.locator('#accountOverlay.open').count() === 0);

  ok('No JS errors', errs.length === 0, errs.join(' | ') || 'none');
  await b.close(); srv.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall green');
  process.exit(failed ? 1 : 0);
})();
