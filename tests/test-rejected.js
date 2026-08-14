/* Two dead ends, both of which left somebody staring at a screen with
   nothing on it they could do.

   A rejected profile. The database has always put a rejected profile back
   into the queue the moment it is saved again — that is not new. What was
   missing was any way to find that out: the reason sat in a red box on the
   profile screen, and the only route back was a small outline button at the
   very bottom, under the ID card and the work list, sharing a row with Sign
   out. So a worker read why they had been turned down and had nothing in
   front of them to act on.

   The sign-up code screen. When sending the code failed, the sentence
   changed to "We couldn't send the code just now" and the six-digit box and
   the Verify button stayed exactly where they were. There is no code coming
   and no way to know that. This screen has always carried a second route —
   the worker sends a code to us from their own WhatsApp, which needs no
   provider at all — and the failure now falls through to it. */
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
}).listen(8850);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

const NOTE = 'The photo shows two people — we need one clear photo of your face.';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8850/'); await page.waitForTimeout(2000);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {}; });

  // ---------- turned down ----------
  await page.evaluate(n => {
    const all = demoAll(); const w = all[0];
    w.status = 'rejected'; w.verified = false; w.review_note = n;
    demoSave(all);
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession(); go('me');
  }, NOTE);
  await page.waitForTimeout(1000);

  /* scoped to #meCard on purpose: the wizard now carries a second, hidden
     copy of this block, and an unscoped selector silently reads that one */
  const me = await page.evaluate(() => {
    const box = document.querySelector('#meCard .vstatus.rejected');
    const btn = box && box.querySelector('button');
    return { text: (box || {}).innerText || '', has: !!btn,
             label: btn ? btn.textContent.trim() : '',
             top: btn ? Math.round(btn.getBoundingClientRect().top) : -1 };
  });
  ok('The reason is on the profile screen', new RegExp('two people').test(me.text));
  ok('…and says there is no limit on trying again', /no limit/.test(me.text));
  ok('…with the way back right there beside it', me.has, me.label);
  ok('…not buried under the ID card and the work list', me.top > 0 && me.top < 700, me.top + 'px');

  // ---------- and it leads somewhere useful ----------
  await page.evaluate(() => document.querySelector('#meCard .vstatus.rejected button').click());
  await page.waitForTimeout(800);
  const reg = await page.evaluate(() => ({
    screen: currentScreen,
    shown: !document.getElementById('regWhyRejected').hidden,
    note: (document.getElementById('regRejectNote') || {}).textContent || '',
    save: (document.getElementById('regSaveBtn') || {}).textContent || '',
  }));
  ok('It opens the form', reg.screen === 'register', reg.screen);
  ok('…still showing what to change, so the reason does not vanish on the way',
     reg.shown && /two people/.test(reg.note));
  ok('…and the button says what saving will actually do',
     /Send back for review/.test(reg.save), reg.save);

  // ---------- saving really does put it back in the queue ----------
  await page.evaluate(() => {
    /* the live database does this in update_worker; preview mode has to be
       told, and the point being tested is the round trip either way */
    const all = demoAll(); const w = all.find(x => x.id === session.worker.id);
    api.update = async (phone, pin, data) => {
      w.status = 'pending'; w.review_note = null; Object.assign(w, data); demoSave(all);
      return w;
    };
  });
  /* the seeded demo worker carries no photo, and saveProfile rightly refuses
     to publish without one — that is a different guard, not the one here */
  await page.evaluate(() => { selfieData = 'data:image/webp;base64,AAAA'; thumbData = selfieData; });
  await page.evaluate(() => saveProfile().catch(() => {}));
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({
    status: statusOf(demoAll().find(x => x.id === session.worker.id)),
  }));
  ok('Saving sends it back into the queue', after.status === 'pending', after.status);

  await page.evaluate(() => go('me')); await page.waitForTimeout(800);
  const back = await page.evaluate(() => ({
    rejected: !!document.querySelector('#meCard .vstatus.rejected'),
    pending: !!document.querySelector('#meCard .vstatus.pending'),
  }));
  ok('…and the profile screen stops saying they were turned down',
     !back.rejected && back.pending);

  // ---------- the code that never arrives ----------
  await page.evaluate(() => {
    LIVE = true; REQUIRE_OTP = true;
    deliverOtp = async () => { throw new Error('provider down'); };
    session = { phone: '9876500099', pin: '1234', name: 'X', registered: false };
    saveSession(); go('otp'); initOtp();
  });
  await page.waitForTimeout(1300);
  const otp = await page.evaluate(() => ({
    said: (document.getElementById('otpSent') || {}).textContent || '',
    code: !document.getElementById('codeFlow').hidden,
    wa: !document.getElementById('waFlow').hidden,
    verify: !!document.querySelector('#codeFlow #otpVerifyBtn:not([hidden])')
            && !document.getElementById('codeFlow').hidden,
  }));
  ok('When no code could be sent, the six-digit box is gone', !otp.code);
  ok('…so is the Verify button, which had nothing to verify', !otp.verify);
  ok('…and the WhatsApp route is offered instead of a dead end', otp.wa);
  ok('…the screen no longer contradicts itself',
     /could not send a code/.test(otp.said), otp.said.slice(0, 78));

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
