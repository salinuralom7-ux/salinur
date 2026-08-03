/* Forgetting four digits used to be permanent. A worker lost their profile,
   their reviews and their MySheher number, and the only way back was to email
   the owner and be believed.

   The proof of ownership is a code sent to the number on the account — the
   one thing about somebody a stranger cannot produce. Most of what makes that
   safe lives in the database and is asserted against the schema here, because
   preview mode has no rate limiting and proving anything against it would
   prove nothing. What the browser drives is the rest: that the way back in
   exists, that it is reachable from both sign-in screens, that a wrong code
   is refused, and that a right one leaves you signed in on the new PIN. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const sql  = fs.readFileSync('/home/user/salinur/docs/supabase-workers-setup.sql', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8851);

let failed = 0;
const ok = (label, cond, extra) => {
  if (!cond) failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));
};
const screen = p => p.evaluate(() => (document.querySelector('.screen.on') || {}).id);
const fnBody = name => {
  const at = sql.lastIndexOf('function public.' + name + '(');
  return sql.slice(at, sql.indexOf('\n$$;', at));
};

(async () => {
  // ---------- what the database promises ----------
  const burn  = fnBody('burn_otp');
  const wReset = fnBody('reset_worker_pin');
  const cReset = fnBody('reset_customer_pin');
  const verify = fnBody('verify_otp');

  /* crypt(null, hash) is null and null <> null is null, so `if` never fires.
     Before this was fixed, verify_otp(phone, null) returned true and marked
     the number verified — measured on a fresh database, not reasoned about. */
  ok('A null code cannot pass verify_otp',
     /p_code is null or p_code !~/.test(verify) && /is distinct from crypt/.test(verify));
  ok('…nor burn a code on the reset path',
     /p_code is null or p_code !~/.test(burn) && /is distinct from crypt/.test(burn));

  /* A raise rolls back the same statement, and the statement is the one that
     increments attempts. Six wrong guesses counted as zero until this. */
  ok('A wrong code is returned, not raised, so the guess is counted',
     /returns text/.test(burn) && /update otp_codes set attempts = attempts \+ 1/.test(burn) &&
     /return 'That code does not match/.test(burn));
  ok('…and both resets answer with (token, error) for the same reason',
     /returns table \(token uuid, error text\)/.test(wReset) &&
     /returns table \(token uuid, error text\)/.test(cReset));
  ok('Six guesses is the limit', /row.attempts >= 6/.test(burn));
  ok('A used code is destroyed', /delete from otp_codes where phone = p_phone/.test(burn));

  ok('A reset ends every other session — worker',
     /delete from worker_sessions where worker_id = wid/.test(wReset));
  ok('…and customer',
     /delete from customer_sessions where customer_id = cid/.test(cReset));
  ok('A reset clears the lockout, so a locked-out person can get back in',
     /delete from auth_attempts +where kind = 'login'/.test(wReset) &&
     /delete from auth_attempts +where kind = 'customer'/.test(cReset));
  ok('The code is checked before the account is admitted to exist',
     wReset.indexOf('burn_otp') < wReset.indexOf('no worker profile') &&
     cReset.indexOf('burn_otp') < cReset.indexOf('no account on this number'));
  ok('burn_otp is never handed to anon',
     !/'burn_otp'/.test(sql.slice(sql.lastIndexOf('client_rpcs text[]'))));
  ok('…but the two resets are',
     /'reset_worker_pin','reset_customer_pin'/.test(sql.slice(sql.lastIndexOf('client_rpcs text[]'))));
  ok('The lock is still the last thing in the file',
     sql.lastIndexOf('select public.lock_public_functions();') >
     sql.lastIndexOf('create or replace function public.reset_customer_pin'));

  // ---------- and the way in ----------
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8851' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8851/'); await p.waitForTimeout(1200);
  await p.evaluate(() => localStorage.setItem('repto_account_asked_v1', '1'));

  // ---------- a customer who has forgotten ----------
  await p.evaluate(async () => {
    localStorage.removeItem('repto_customers_demo_v1');
    await api.registerCustomer('9876500111', '1234', 'Priya Das', 'Beltola');
    customer = null; saveCustomer();
    showAccount('signin');
  });
  await p.waitForTimeout(500);
  ok('The sign-in tab offers a way back', await p.locator('#acctForgot').isVisible());
  ok('…and the sign-up tab does not',
     await p.evaluate(async () => { showAccount('signup');
       await new Promise(r => setTimeout(r, 200));
       return document.getElementById('acctForgot').hidden; }));

  await p.evaluate(() => showAccount('signin')); await p.waitForTimeout(300);
  await p.fill('#acctPhone', '9876500111');
  await p.locator('#acctForgot').click(); await p.waitForTimeout(500);
  ok('It opens the recovery screen', await screen(p) === 'scr-recover', await screen(p));
  ok('…carrying the number already typed', await p.inputValue('#recPhone') === '9876500111');

  await p.locator('#recSendBtn').click(); await p.waitForTimeout(700);
  ok('Asking for a code moves to the code step', await p.locator('#recStep2').isVisible());
  ok('Preview mode says the code is not really being sent',
     /no database here/i.test(await p.locator('#recPreview').innerText()));
  const code = (await p.locator('#recPreview b').innerText()).trim();
  ok('…and shows one', /^\d{6}$/.test(code), code);

  // wrong code
  await p.fill('#recCode', '000000'); await p.fill('#recPin', '4321');
  await p.locator('#recGoBtn').click(); await p.waitForTimeout(600);
  ok('A wrong code is refused', await screen(p) === 'scr-recover');
  ok('…and the code box is cleared to be retyped', await p.inputValue('#recCode') === '');

  // short PIN
  await p.fill('#recCode', code); await p.fill('#recPin', '43');
  await p.locator('#recGoBtn').click(); await p.waitForTimeout(600);
  ok('A short PIN is refused', await screen(p) === 'scr-recover');

  // the real thing
  await p.fill('#recPin', '4321');
  await p.locator('#recGoBtn').click(); await p.waitForTimeout(1000);
  ok('The right code sets the new PIN and signs them in',
     await p.evaluate(() => signedIn()) === true, await screen(p));
  ok('…as the right person', await p.evaluate(() => customer.phone) === '9876500111');
  ok('The old PIN no longer works',
     await p.evaluate(async () => (await api.loginCustomer('9876500111', '1234')) === null));
  ok('…and the new one does',
     await p.evaluate(async () => !!(await api.loginCustomer('9876500111', '4321'))));
  ok('The code cannot be used a second time', await p.evaluate(async code => {
    const r = await api.resetCustomerPin('9876500111', code, '9999');
    return r.token === null && /ask for a code/i.test(r.error);
  }, code));

  // ---------- six guesses is the limit here too ----------
  const limited = await p.evaluate(async () => {
    await api.sendCode('9876500111');
    const out = [];
    for (let i = 0; i < 7; i++) out.push((await api.resetCustomerPin('9876500111', '000001', '5555')).error);
    return out;
  });
  ok('Guessing is capped in preview too',
     /Too many wrong tries/.test(limited[6]), limited[6]);

  // ---------- a worker who has forgotten ----------
  await p.evaluate(() => { customer = null; saveCustomer(); go('work'); });
  await p.waitForTimeout(600);
  ok('The worker sign-in offers it too',
     (await p.locator('#authIn .block-link').innerText()).includes('Forgotten'));

  const workerPhone = await p.evaluate(() => demoAll()[0].phone);
  await p.fill('#inPhone', workerPhone);
  await p.locator('#authIn .block-link').click(); await p.waitForTimeout(500);
  ok('…and reaches the same screen', await screen(p) === 'scr-recover');
  ok('…carrying that number', await p.inputValue('#recPhone') === workerPhone);

  await p.locator('#recSendBtn').click(); await p.waitForTimeout(700);
  const wcode = (await p.locator('#recPreview b').innerText()).trim();
  await p.fill('#recCode', wcode); await p.fill('#recPin', '8642');
  await p.locator('#recGoBtn').click(); await p.waitForTimeout(1200);
  ok('A worker lands back in their own profile', await screen(p) === 'scr-me', await screen(p));
  ok('…signed in on the new PIN',
     await p.evaluate(() => session && session.registered && session.pin) === '8642');
  ok('…and the stored PIN really changed',
     await p.evaluate(ph => demoAll().find(w => w.phone === ph).pin, workerPhone) === '8642');

  // ---------- a number nobody has ----------
  await p.evaluate(() => { signOut(); go('work'); }); await p.waitForTimeout(600);
  const stranger = await p.evaluate(async () => {
    await api.sendCode('9998887776');
    const m = JSON.parse(localStorage.getItem('repto_recovery_demo_v1'));
    return await api.resetWorkerPin('9998887776', m['9998887776'].code, '1111');
  });
  ok('An unregistered number is told only after the code is right',
     stranger.token === null && /no worker profile/i.test(stranger.error), stranger.error);

  ok('No JS errors', errs.length === 0, errs.join(' | ') || 'none');
  await b.close(); srv.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall green');
  process.exit(failed ? 1 : 0);
})();
