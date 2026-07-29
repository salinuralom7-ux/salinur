/* Covers what the pre-launch audit changed: back-button navigation, the
   manifest shortcuts, rating abuse, reporting, and the admin PIN no longer
   being written down in the source. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8811);

const ok = (label, cond, extra) => console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('nearse_preview_admin', '4242'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // ---------- no admin PIN in the shipped source ----------
  ok('No admin PIN literal in the source', !/Repto@20/.test(html));
  ok('No DEMO_ADMIN_PIN constant', !/DEMO_ADMIN_PIN/.test(html));

  await page.goto('http://localhost:8811/');
  await page.waitForTimeout(800);

  // ---------- back button walks the app, not out of it ----------
  const screen = () => page.evaluate(() => (document.querySelector('.screen.on') || {}).id);
  await page.locator('#ctaHire').click(); await page.waitForTimeout(600);
  ok('Browse opens', await screen() === 'scr-hire');
  ok('Browse has its own URL', (await page.evaluate(() => location.hash)) === '#hire');
  await page.goBack(); await page.waitForTimeout(400);
  ok('Back returns to the landing screen', await screen() === 'scr-home');
  await page.goForward(); await page.waitForTimeout(500);
  ok('Forward goes to browse again', await screen() === 'scr-hire');

  // back closes a sheet before it leaves the screen
  await page.locator('.wcard').first().click(); await page.waitForTimeout(400);
  ok('Worker sheet opens', await page.locator('#wOverlay.open').count() === 1);
  await page.goBack(); await page.waitForTimeout(400);
  ok('Back closes the sheet', await page.locator('#wOverlay.open').count() === 0);
  ok('…and stays on browse', await screen() === 'scr-hire');
  await page.goBack(); await page.waitForTimeout(400);
  ok('Back again leaves the screen', await screen() === 'scr-home');

  // a sheet that replaces another still only costs one back press
  await page.locator('#ctaHire').click(); await page.waitForTimeout(600);
  await page.locator('.wcard').first().click(); await page.waitForTimeout(400);
  await page.locator('#bookCta').click(); await page.waitForTimeout(400);
  // which sheet opens depends on the service's booking mode; whichever it is,
  // it must replace the worker sheet rather than stack on top of it
  ok('Booking sheet replaces the worker sheet',
     await page.locator('.overlay.open').count() === 1 && await page.locator('#wOverlay.open').count() === 0,
     await page.evaluate(() => (document.querySelector('.overlay.open') || {}).id));
  await page.goBack(); await page.waitForTimeout(400);
  ok('One back press clears both sheets',
     await page.locator('.overlay.open').count() === 0 && await screen() === 'scr-hire');

  // ---------- manifest shortcuts land where they claim ----------
  const manifest = JSON.parse(fs.readFileSync('/home/user/salinur/docs/manifest.webmanifest', 'utf8'));
  for (const sc of manifest.shortcuts) {
    const hash = sc.url.split('#')[1];
    const p = await ctx.newPage();
    await p.goto('http://localhost:8811/#' + hash);
    // wait for the router to settle rather than guessing at a timeout: the
    // boot path probes Supabase first, and under load 900ms was not always
    // enough, which made this assertion flap
    await p.waitForFunction(
      () => document.querySelector('.screen.on') &&
            document.querySelector('.screen.on').id !== 'scr-home',
      null, { timeout: 8000 }).catch(() => {});
    const id = await p.evaluate(() => (document.querySelector('.screen.on') || {}).id);
    ok(`Shortcut "${sc.name}" (#${hash}) opens a real screen`, id !== 'scr-home', id);
    await p.close();
  }

  // ---------- one rating per device ----------
  await page.locator('.wcard').first().click(); await page.waitForTimeout(300);
  const stars = () => page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem('nearse_workers_v1')).find(x => x.id === currentWorker.id);
    return [w.rating_sum, w.rating_count];
  });
  const before = await stars();
  for (let i = 0; i < 5; i++) {
    await page.locator('#rateStars span[data-s="5"]').click();
    await page.locator('.rating-box button').click();
    await page.waitForTimeout(250);
  }
  const after = await stars();
  ok('Five taps count as one rating', after[1] === before[1] + 1, `${before} → ${after}`);
  await page.locator('#rateStars span[data-s="1"]').click();
  await page.locator('.rating-box button').click();
  await page.waitForTimeout(300);
  const changed = await stars();
  ok('Changing your mind replaces, never adds',
     changed[1] === after[1] && changed[0] === before[0] + 1, `${after} → ${changed}`);

  // ---------- reporting ----------
  ok('Report link is on the worker sheet', await page.locator('.report-link').count() === 1);
  await page.locator('.report-link').click(); await page.waitForTimeout(400);
  ok('Report sheet opens', await page.locator('#reportOverlay.open').count() === 1);
  ok('Reasons offered', await page.locator('#reportReason option').count() >= 5);
  await page.selectOption('#reportReason', { index: 1 });
  await page.fill('#reportDetails', 'Photo does not match the person who came.');
  await page.locator('#reportSendBtn').click();
  await page.waitForTimeout(600);
  ok('Report sheet closes on send', await page.locator('#reportOverlay.open').count() === 0);
  ok('Report stored', await page.evaluate(() => JSON.parse(localStorage.getItem('nearse_reports_v1') || '[]').length) === 1);

  // ---------- the admin sees it ----------
  const admin = await ctx.newPage();
  admin.on('dialog', d => d.accept('4242'));
  await admin.goto('http://localhost:8811/#admin');
  await admin.waitForTimeout(1400);
  ok('Admin opens with the per-browser preview PIN', await admin.locator('#scr-admin.on').count() === 1);
  ok('Dashboard flags the open report', (await admin.locator('.todo-bar').innerText()).includes('open report'));
  await admin.locator('.admin-tabs .tab', { hasText: 'Review' }).click();
  await admin.waitForTimeout(900);
  ok('Open report shown to the admin', await admin.locator('.report-item').count() === 1);
  await admin.locator('.report-item .btn').click();
  await admin.waitForTimeout(700);
  ok('Marking it done clears it', await admin.locator('.report-item').count() === 0);

  // wrong PIN is refused
  const bad = await ctx.newPage();
  bad.on('dialog', d => d.accept('0000'));
  await bad.goto('http://localhost:8811/#admin');
  await bad.waitForTimeout(1200);
  ok('Wrong admin PIN refused', await bad.locator('#scr-admin.on').count() === 0);

  // ---------- photo upload rejects rubbish instead of doing nothing ----------
  await page.evaluate(() => { session = {phone:'9435019999', pin:'1111', name:'Tester', registered:false}; go('register'); });
  await page.waitForTimeout(600);
  await page.setInputFiles('#selfieInput', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await page.waitForTimeout(500);
  ok('Non-image rejected with a message',
     (await page.locator('#toast').textContent()).length > 0 && await page.locator('#selfieCircle img').count() === 0,
     (await page.locator('#toast').textContent()));

  // ---------- the OTP screen survives the admin turning codes on ----------
  await page.evaluate(() => { REQUIRE_OTP = true; LIVE = false; session = {phone:'9435019999', pin:'1111', name:'T', registered:false}; });
  await page.evaluate(() => go('otp'));
  await page.waitForTimeout(500);
  ok('OTP screen renders in code mode', await page.locator('#scr-otp.on').count() === 1);

  ok('No JS errors anywhere', errors.length === 0, errors.join(' | ') || 'none');
  await browser.close(); srv.close();
})();
