/* "Forgotten your PIN?" — saying where the code actually went.

   Codes go by email now, because the WhatsApp Cloud API takes over whatever
   phone number it is given and stops that number working in the WhatsApp app,
   and there was no spare SIM. Email needs no number at all.

   It does not reach everybody. The email field is optional at registration
   and a good many service experts in Guwahati never fill it in. So the
   screen has four different things to say, and the whole point of this test
   is that it says the right one — somebody told "check WhatsApp" when the
   code went to their email, or when no code was sent at all, is left staring
   at a phone that will never buzz.

   The database side is proved against real Postgres by the migration's own
   checks and by tests/test-otp-send.js for the sender. This is the screen. */
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
}).listen(8846);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

/* what send_otp can answer, and what each one has to produce on screen */
const CASES = [
  { answer: 'email:sa••••••••@gmail.com',
    label:  'the code went to an email',
    says:   'emailed a 6-digit code to sa••••••••@gmail.com',
    form:   true },
  { answer: 'sent',
    label:  'the code went to WhatsApp',
    says:   'on WhatsApp',
    form:   true },
  { answer: 'no-email',
    label:  'we have no address for this number',
    says:   'no email address for this number',
    form:   false },
  { answer: 'no-provider',
    label:  'nothing is connected at all',
    says:   'No message provider is connected',
    form:   false },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8846/'); await page.waitForTimeout(2000);

  /* Two sheets open on a timer a few seconds in and would swallow the clicks.
     Nothing here is about them. */
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {};
                              document.querySelectorAll('.overlay.open')
                                      .forEach(o => o.classList.remove('open')); });

  /* Waiting a fixed 350ms for the screen to arrive lost the race under load
     — the click then spent its full thirty seconds looking for a button on a
     screen that had not been drawn, and the file died there rather than
     failing an assertion. Wait for the screen. */
  const onRecover = async () => {
    await page.waitForSelector('#scr-recover.on', { timeout: 8000 });
    await page.waitForSelector('#recSendBtn:not([hidden])', { state: 'visible', timeout: 8000 });
  };

  for (const c of CASES) {
    await page.evaluate(a => { api.sendCode = async () => a; go('recover'); recoverStep(1); }, c.answer);
    await onRecover();
    await page.fill('#recPhone', '7086599367');
    await page.click('#recSendBtn');
    await page.waitForTimeout(450);

    const st = await page.evaluate(() => ({
      said: ((document.getElementById('recSentTo').innerText || '') + ' ' +
             (document.getElementById('recPreview').innerText || '')).replace(/\s+/g, ' ').trim(),
      form: !document.getElementById('recForm').hidden,
      ask:  !document.getElementById('recAskUs').hidden,
    }));

    ok(`[${c.label}] the screen says so`, st.said.includes(c.says), st.said.slice(0, 96));
    ok(`[${c.label}] the code box is ${c.form ? 'there' : 'gone'}`, st.form === c.form);
    ok(`[${c.label}] the "message us" button is ${c.form ? 'gone' : 'there'}`, st.ask === !c.form);
    if (!c.form) {
      /* the fallback has to actually reach us, with the number filled in */
      const href = await page.evaluate(() => {
        const b = document.getElementById('recAskUs');
        const m = (b.getAttribute('onclick') || '').match(/wa\.me\/(\d+)/);
        return m ? m[1] : null;
      });
      ok(`[${c.label}] …and it opens our WhatsApp`, href === '917086599367', href);
    }
    await page.evaluate(() => go('home')); await page.waitForTimeout(200);
  }

  /* An address must never arrive here unmasked — the database masks it, and
     the screen must not be quietly undoing that by showing something else. */
  await page.evaluate(() => { api.sendCode = async () => 'email:sa••••••••@gmail.com';
                              go('recover'); recoverStep(1); });
  await onRecover();
  await page.fill('#recPhone', '7086599367');
  await page.click('#recSendBtn'); await page.waitForTimeout(400);
  const shown = await page.evaluate(() => document.getElementById('recSentTo').innerText);
  /* pull out the address itself and check it is the masked form: the local
     part must still carry bullets by the time it reaches the screen */
  const addr = (shown.match(/\S+@\S+/) || [''])[0].replace(/[.,]$/, '');
  ok('The address on screen is the masked one, not a full address',
     addr.includes('•') && addr.split('@')[0].includes('•'), addr);

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
