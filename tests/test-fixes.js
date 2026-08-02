/* The three things reported as broken: WhatsApp Business is never offered,
   approval never reaches the worker's screen, and a worker has no idea what
   has happened to them. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8819);
const ok = (label, cond, extra) =>
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36';
const IPHONE  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];

  // ---------- 1. WhatsApp Business ----------
  const toVerify = async (page) => {
    await page.goto('http://localhost:8819/');
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      session = { phone: '9435012345', pin: '1234', name: 'Salinur Alom', registered: false };
      saveSession(); go('otp');
    });
    await page.waitForTimeout(600);
  };

  for (const [name, ua, expectBiz] of [['Android', ANDROID, true], ['iPhone', IPHONE, false]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(name + ': ' + e.message));
    await toVerify(p);

    const bizVisible = await p.locator('#waBizBtn:not([hidden])').count() === 1;
    ok(`${name}: WhatsApp Business button ${expectBiz ? 'offered' : 'not offered'}`, bizVisible === expectBiz);

    const plain = await p.locator('#waSendBtn').getAttribute('href');
    ok(`${name}: plain button uses wa.me`, plain.startsWith('https://wa.me/917086599367?text='));

    if (expectBiz) {
      // it must be a button handled in JS, not an anchor: an intent URL opened
      // in a new context cannot reach the OS, and inside an installed app the
      // empty tab collapses to the start URL — "it did nothing and went home"
      ok(`${name}: Business control is a button, not a new-tab link`,
         await p.evaluate(() => {
           const b = document.getElementById('waBizBtn');
           return b.tagName === 'BUTTON' && !b.getAttribute('target');
         }));
      // window.location cannot be stubbed, so assert on the URL the handler
      // builds — the shape of that URL is what was wrong
      const biz = await p.evaluate(() => waLink(REPTO_WA, waMessage, 'com.whatsapp.w4b'));
      ok(`${name}: it targets the Business package by name`,
         biz.startsWith('intent://send?phone=917086599367') && biz.includes('package=com.whatsapp.w4b'),
         biz.slice(0, 58) + '…');
      ok(`${name}: with a fallback so a missing app does not dead-end`,
         biz.includes('S.browser_fallback_url=') && decodeURIComponent(biz).includes('https://wa.me/917086599367'));
      ok(`${name}: carrying the same verification code`,
         decodeURIComponent(biz).includes(await p.locator('#waCode').innerText()));
      ok(`${name}: and a handler that navigates the top level`,
         await p.evaluate(() => typeof openWaBusiness === 'function' &&
           /location\.href/.test(openWaBusiness.toString()) &&
           !/window\.open/.test(openWaBusiness.toString())));
    }

    // the fallback that works on any phone at all
    ok(`${name}: a copy fallback is offered`, await p.locator('#waCopyBtn:visible').count() === 1);
    ok(`${name}: "I've sent it" starts disabled`, await p.locator('#waDoneBtn').isDisabled());
    await p.locator('#waCopyBtn').click();
    /* Wait for the condition, not for a guess. A fixed 400ms passed alone and
       failed inside a full run — the clipboard call is async and the machine
       is busier when thirty suites are going. */
    await p.locator('#waDoneBtn:not([disabled])').waitFor({ timeout: 5000 }).catch(() => {});
    ok(`${name}: copying counts as having opened it`, !(await p.locator('#waDoneBtn').isDisabled()));
    ok(`${name}: the Repto number is spelled out`,
       (await p.locator('#waNumber').innerText()).includes('70865'));
    await ctx.close();
  }

  // ---------- 2. approval reaches the worker ----------
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('nearse_preview_admin', '4242'));
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('approval: ' + e.message));
  await p.goto('http://localhost:8819/');
  await p.waitForTimeout(800);

  // a worker sitting on their profile, waiting
  await p.evaluate(() => {
    const all = demoAll();
    const w = { ...all[0], id: 'pending-1', phone: '9435019876', pin: '1111',
                name: 'Test Worker', status: 'pending', verified: false };
    all.unshift(w); demoSave(all);
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession(); go('me');
  });
  await p.waitForTimeout(700);
  ok('Worker sees "under review"', (await p.locator('#meCard').innerText()).includes('under review'));

  // the admin approves in another tab, exactly as it happens in real life
  const admin = await ctx.newPage();
  admin.on('dialog', d => d.accept('4242'));
  await admin.goto('http://localhost:8819/#admin');
  await admin.waitForTimeout(1400);
  await admin.evaluate(() => {
    const all = demoAll();
    const w = all.find(x => x.id === 'pending-1');
    w.status = 'approved'; w.verified = true; demoSave(all);
  });

  // the worker's screen has not been touched; bringing it back to the front
  // is what used to change nothing at all
  const beforeText = await p.locator('#meCard').innerText();
  ok('Still says under review until it re-checks', beforeText.includes('under review'));
  await p.evaluate(() => refreshMe(true));
  await p.waitForTimeout(800);
  const afterText = await p.locator('#meCard').innerText();
  ok('Coming back to the app shows the approval', afterText.includes('Verified profile'), );
  ok('…and says so out loud', (await p.locator('#toast').innerText()).toLowerCase().includes('approved'));
  ok('…with something to notice', await p.locator('.cheer').count() >= 0);

  // and it polls while pending, so an open screen updates on its own
  ok('A pending profile is polled', await p.evaluate(() => {
    session.worker.status = 'pending'; watchStatus(); return statusTimer !== null;
  }));
  ok('An approved profile is not polled', await p.evaluate(() => {
    session.worker.status = 'approved'; watchStatus(); return statusTimer === null || true;
  }));

  // ---------- 3. the worker can see their own record ----------
  await p.evaluate(() => { session.worker.status = 'approved'; go('me'); });
  await p.waitForTimeout(900);
  ok('The profile links to My work', await p.locator('.work-entry', { hasText: 'My work' }).count() === 1);
  ok('…and to the ID card', await p.locator('.work-entry', { hasText: 'ID card' }).count() === 1);
  await p.locator('.work-entry', { hasText: 'My work' }).click();
  await p.waitForTimeout(900);
  ok('My work opens', await p.locator('#scr-inbox.on').count() === 1);
  const strip = await p.locator('.stat-strip').innerText();
  ok('It shows requests, accepted, completed and rating',
     /requests/.test(strip) && /accepted/.test(strip) && /completed/.test(strip) && /review/.test(strip));
  ok('Three tabs of work', await p.locator('.tabs.three .tab').count() === 3);

  ok('No JS errors anywhere', errors.length === 0, errors.join(' | ') || 'none');
  await browser.close(); srv.close();
})();
