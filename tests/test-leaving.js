/* Deleting a profile: no spelling test, a reason worth collecting, and a
   photo that actually goes. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8829);
const ok = (label, cond, extra) =>
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  // any surviving confirm()/prompt() would hang the run, so fail loudly instead
  let dialogs = 0;
  p.on('dialog', d => { dialogs++; d.dismiss(); });

  await p.goto('http://localhost:8829/');
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const w = demoAll()[0];
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession(); go('me');
  });
  await p.waitForTimeout(700);

  // ---------- no typing test ----------
  await p.locator('.danger-zone .btn-danger').click();
  await p.waitForTimeout(600);
  ok('A proper sheet opens, not a browser prompt', await p.locator('#leaveOverlay.open').count() === 1);
  ok('Nothing asked the browser to prompt', dialogs === 0, dialogs + ' dialogs');
  ok('It asks plainly whether you are sure',
     (await p.locator('#leaveStep1 h3').innerText()).toLowerCase().includes('delete your repto profile'));
  ok('It lists what goes', await p.locator('.leave-list li').count() >= 3);
  ok('Keeping the profile is offered too',
     (await p.locator('#leaveStep1').innerText()).includes('Keep my profile'));
  ok('The word DELETE is nowhere in the flow',
     !(await p.locator('#leaveOverlay').innerText()).includes('type DELETE'));

  // backing out leaves the profile alone
  await p.locator('#leaveStep1 .btn-quiet').click();
  await p.waitForTimeout(400);
  ok('Backing out closes it', await p.locator('#leaveOverlay.open').count() === 0);
  ok('…and the profile is still there',
     await p.evaluate(() => demoAll().some(w => w.phone === session.worker.phone)));

  // ---------- the poll ----------
  await p.locator('.danger-zone .btn-danger').click();
  await p.waitForTimeout(400);
  await p.locator('#leaveStep1 .btn-danger').click();
  await p.waitForTimeout(500);
  ok('Step two asks why', await p.locator('#leaveStep2:visible').count() === 1);
  const reasons = await p.locator('.leave-reason').allTextContents();
  ok('Reasons offered', reasons.length >= 6, reasons.length + ': ' + reasons.slice(0, 3).join(' / ') + ' …');
  ok('  covers "not enough bookings"', reasons.some(r => /not getting enough bookings/i.test(r)));
  ok('  covers "app is confusing"',     reasons.some(r => /confusing/i.test(r)));
  ok('  covers "taking a break"',       reasons.some(r => /taking a break/i.test(r)));
  ok('There is room to say more', await p.locator('#leaveNote').count() === 1);

  await p.locator('.leave-reason').nth(0).click();
  await p.waitForTimeout(200);
  ok('Choosing one marks it', await p.locator('.leave-reason.on').count() === 1);
  await p.fill('#leaveNote', 'Only two enquiries in a month.');

  const wid = await p.evaluate(() => session.worker.id);   // the demo seed reuses one phone
  await p.locator('#leaveGoBtn').click();
  await p.waitForTimeout(1200);

  // ---------- goodbye ----------
  ok('It says goodbye properly',
     (await p.locator('#leaveStep3 h3').innerText()).toLowerCase().includes('sad to see you go'));
  ok('…and says they can come back',
     (await p.locator('#leaveStep3').innerText()).toLowerCase().includes('register again'));
  ok('The profile is gone', !(await p.evaluate(id => demoAll().some(x => x.id === id), wid)));
  ok('The session is cleared', await p.evaluate(() => session === null));

  await p.locator('#leaveStep3 .btn-brand').click();
  await p.waitForTimeout(500);
  ok('It lands back on the landing screen',
     await p.evaluate(() => (document.querySelector('.screen.on') || {}).id) === 'scr-home');
  ok('The door invites registration again',
     (await p.locator('#ctaWorkTitle').innerText()).trim() === 'Register as a worker');

  // ---------- the photo goes through the storage API, not SQL ----------
  // Supabase forbids a direct delete on storage.objects; doing it in SQL took
  // the whole deletion down. The client must issue a DELETE to the API.
  const calls = await p.evaluate(async () => {
    const seen = [];
    const realFetch = window.fetch;
    window.fetch = (u, o) => { seen.push({ url: String(u), method: (o || {}).method }); return realFetch(u, o); };
    const wasLive = LIVE; LIVE = true;
    await removeStoredPhotos([
      'https://x.supabase.co/storage/v1/object/public/selfies/abc.webp',
      'p/def.webp'
    ]).catch(() => {});
    LIVE = wasLive; window.fetch = realFetch;
    return seen;
  });
  const deletes = calls.filter(c => c.method === 'DELETE');
  ok('Both photos are deleted through the storage API', deletes.length === 2, deletes.length + ' DELETE calls');
  ok('  the full URL is reduced to the object name',
     deletes.some(d => d.url.endsWith('/storage/v1/object/selfies/abc.webp')),
     (deletes[0] || {}).url);
  ok('  a bare path is used as-is',
     deletes.some(d => d.url.endsWith('/storage/v1/object/selfies/p/def.webp')));
  const sqlAfter = (fs.readFileSync('/home/user/salinur/docs/supabase-workers-setup.sql', 'utf8')
      .split('MIGRATION 19')[1] || '')
      .split('\n').filter(l => !l.trim().startsWith('--')).join('\n');   // comments explain the old bug
  ok('No SQL statement deletes from storage.objects any more',
     !/delete\s+from\s+storage\.objects/i.test(sqlAfter));

  ok('No JS errors anywhere', errors.length === 0, errors.join(' | ') || 'none');
  await browser.close(); srv.close();
})();
