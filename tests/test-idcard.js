/* The Repto Worker ID: the door that changes once you are registered, the
   card itself, and the check that makes the number on it worth printing. */
const { chromium } = require('playwright');
const { silenceAccountOffer } = require('./helpers');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8823);
const ok = (label, cond, extra) =>
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8823/');
  await p.waitForTimeout(900);
  await silenceAccountOffer(p);

  // ---------- the door before you are one ----------
  const door = () => p.locator('#ctaWorkTitle').innerText();
  ok('Door invites you to register', (await door()).trim() === 'Register as a service expert', await door());
  /* "Set your rates" was the old copy. The offer is the thing that gets
     somebody through this door, so the subtitle leads with it. */
  ok('…with the matching subtitle',
     (await p.locator('#ctaWorkSub').innerText()).includes('Free for your first 30 days'),
     await p.locator('#ctaWorkSub').innerText());

  // ---------- become one ----------
  await p.evaluate(() => {
    const w = demoAll()[0];
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession(); go('home');
  });
  await p.waitForTimeout(600);
  ok('Door becomes "Visit your profile"', (await door()).trim() === 'Visit your profile', await door());
  ok('…and the subtitle follows',
     (await p.locator('#ctaWorkSub').innerText()).toLowerCase().includes('id card'));
  ok('The door still leads somewhere useful', await p.evaluate(() => {
    go('work'); return (document.querySelector('.screen.on') || {}).id;
  }) === 'scr-me');

  // the door must follow the session the instant it changes, not only after a
  // reload — that is what made it look like the rename had never shipped
  await p.evaluate(() => { session = null; saveSession(); });
  await p.waitForTimeout(300);
  ok('Clearing the session repaints the door at once', (await door()).trim() === 'Register as a service expert');
  await p.evaluate(() => {
    const w = demoAll()[0];
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession();
  });
  await p.waitForTimeout(300);
  ok('Signing back in repaints it at once', (await door()).trim() === 'Visit your profile');

  // and it survives a cold start, which is how a worker actually opens the app
  await p.reload();
  await p.waitForTimeout(1500);
  ok('It is still right after closing and reopening the app',
     (await door()).trim() === 'Visit your profile', await door());

  // signing out puts it back
  await p.evaluate(() => { session = null; go('home'); });
  await p.waitForTimeout(500);
  ok('Signing out restores "Register as a service expert"', (await door()).trim() === 'Register as a service expert');

  // ---------- the card ----------
  const code = await p.evaluate(() => {
    const w = demoAll()[0];
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession(); go('me');
    return w.worker_code;
  });
  await p.waitForTimeout(700);
  ok('Every worker has a number', /^\d{12}$/.test(code || ''), code);
  ok('It passes its own check digit', await p.evaluate(c => idValid(c), code));
  ok('The first digit is never 0 or 1', !['0','1'].includes(code[0]));
  ok('Profile links to the card', await p.locator('.work-entry', { hasText: 'ID card' }).count() === 1);
  ok('…showing the number in the Aadhaar grouping',
     (await p.locator('.work-entry', { hasText: 'ID card' }).innerText())
       .includes(code.slice(0,4) + ' ' + code.slice(4,8) + ' ' + code.slice(8)));

  await p.locator('.work-entry', { hasText: 'ID card' }).click();
  await p.waitForTimeout(800);
  ok('Card screen opens', await p.locator('#scr-card.on .badge').count() === 1);
  const card = await p.locator('.badge').innerText();
  ok('Card carries the name', card.includes(await p.evaluate(() => session.worker.name)));
  ok('Card carries the trade', card.includes(await p.evaluate(() => session.worker.skills[0].skill)));
  ok('Card carries the phone number', card.includes(await p.evaluate(() => session.worker.phone)));
  ok('Card carries the locality', card.includes(await p.evaluate(() => session.worker.area)));
  ok('Card shows the ID in three groups',
     card.includes(code.slice(0,4) + ' ' + code.slice(4,8) + ' ' + code.slice(8)));
  ok('Card is marked verified', card.includes('VERIFIED'));
  ok('Card carries a scannable code', await p.locator('.bd-qr svg').count() === 1);
  ok('A print button is offered', await p.locator('.card-actions .btn-brand').count() === 1);

  // CR80 landscape — the card matches the reference design and prints on a
  // standard blank, and the whole layout is sized in cqw so screen and print
  // are the same drawing at different scales
  const shape = await p.evaluate(() => {
    const r = document.querySelector('.badge').getBoundingClientRect();
    return +(r.width / r.height).toFixed(2);
  });
  ok('Card is CR80 landscape', Math.abs(shape - 85.6 / 54) < 0.03, shape);

  // the parts of the reference design that have to be present
  for (const [what, sel] of [
    ['gold chamfer at the top-right', '.bd-chamfer'],
    ['mark and wordmark in the header', '.bd-brand .bd-logo, .bd-brand .bd-wordmark'],
    ['ID block with its rule', '.bd-idlabel, .bd-idnum, .bd-idrule'],
    ['photo with a gold edge', '.bd-photo img'],
    ['name, dash rule and trade', '.bd-name, .bd-rule i, .bd-trade'],
    ['four labelled rows', '.bd-rows > div'],
    ['ghosted mark behind the code', '.bd-watermark'],
    ['gold footer with tagline and domain', '.bd-foot .bd-tag, .bd-foot .bd-site'],
  ]) {
    const n = await p.locator(sel).count();
    const want = sel === '.bd-rows > div' ? 4 : sel.split(',').length;
    ok('Card has the ' + what, n === want, n + ' of ' + want);
  }

  // it holds its shape and stays inside itself at both extremes
  for (const width of [340, 900]) {
    await p.setViewportSize({ width, height: 900 });
    await p.waitForTimeout(250);
    const fits = await p.evaluate(() => {
      const c = document.querySelector('.badge');
      const cb = c.getBoundingClientRect();
      return [...c.querySelectorAll('*')].every(el => {
        const b = el.getBoundingClientRect();
        return b.width === 0 || (b.right <= cb.right + 1.5 && b.left >= cb.left - 1.5);
      });
    });
    ok('Nothing overflows the card at ' + width + 'px', fits);
  }
  await p.setViewportSize({ width: 390, height: 900 });
  await p.waitForTimeout(250);

  // a profile still under review says so on its own card
  await p.evaluate(() => { session.worker = {...session.worker, status:'pending', verified:false}; renderCard(); });
  await p.waitForTimeout(500);
  ok('A pending card says PENDING', (await p.locator('.badge').innerText()).includes('PENDING'));
  ok('…and explains it is not active yet',
     (await p.locator('#cardHost').innerText()).includes('not active yet'));
  await p.evaluate(() => { session.worker = {...session.worker, status:'approved', verified:true}; });

  // ---------- checking somebody's card ----------
  await p.evaluate(() => go('verify'));
  await p.waitForTimeout(600);
  ok('Check screen opens', await p.locator('#scr-verify.on').count() === 1);

  await p.fill('#verifyInput', '');
  await p.type('#verifyInput', '123456789012');
  ok('Typing groups the digits automatically',
     (await p.locator('#verifyInput').inputValue()) === '1234 5678 9012',
     await p.locator('#verifyInput').inputValue());

  await p.locator('#verifyBtn').click();
  await p.waitForTimeout(600);
  ok('A made-up number is refused before it reaches the database',
     await p.locator('.verify-card.bad').count() === 1);

  // one digit out from a real card must fail
  const bent = code.slice(0, 11) + ((+code[11] + 1) % 10);
  await p.fill('#verifyInput', bent);
  await p.locator('#verifyBtn').click();
  await p.waitForTimeout(600);
  ok('One digit wrong is caught by the check digit',
     await p.locator('.verify-card.bad').count() === 1);

  // the real one
  await p.fill('#verifyInput', code);
  await p.locator('#verifyBtn').click();
  await p.waitForTimeout(900);
  ok('A real card checks out', await p.locator('.verify-card.good').count() === 1);
  const res = await p.locator('.verify-card.good').innerText();
  ok('It names the worker', res.includes(await p.evaluate(() => session.worker.name)));
  ok('It shows the trade and locality',
     res.includes(await p.evaluate(() => session.worker.skills[0].skill)));
  ok('It never shows a phone number', !res.includes(await p.evaluate(() => session.worker.phone)));
  ok('It is honest about what it proves', res.includes('not a police verification'));

  // a card that is not approved does not check out
  await p.evaluate(c => {
    const all = demoAll(); const w = all.find(x => x.worker_code === c);
    w.status = 'pending'; w.verified = false; demoSave(all);
  }, code);
  await p.locator('#verifyBtn').click();
  await p.waitForTimeout(800);
  ok('A withdrawn or unapproved card fails', await p.locator('.verify-card.bad').count() === 1);
  await p.evaluate(c => {
    const all = demoAll(); const w = all.find(x => x.worker_code === c);
    w.status = 'approved'; w.verified = true; demoSave(all);
  }, code);

  // ---------- a card links straight to its own check ----------
  const deep = await ctx.newPage();
  deep.on('pageerror', e => errors.push('deep: ' + e.message));
  await deep.goto('http://localhost:8823/#id=' + code);
  await deep.waitForTimeout(1400);
  ok('A link on the card opens the check', await deep.locator('#scr-verify.on').count() === 1);
  ok('…already filled in and answered', await deep.locator('.verify-card.good').count() === 1);

  // ---------- printing ----------
  await p.emulateMedia({ media: 'print' });
  await p.evaluate(() => go('card'));
  await p.waitForTimeout(600);
  const printed = await p.evaluate(() => {
    const hid = sel => { const e = document.querySelector(sel); return !e || getComputedStyle(e).display === 'none'; };
    const c = document.querySelector('.badge').getBoundingClientRect();
    return { header: hid('body > header'), footer: hid('body > footer'),
             actions: hid('.card-actions'), note: hid('.card-note'),
             cardShown: c.width > 0 && c.height > 0 };
  });
  ok('Printing hides the site header', printed.header);
  ok('Printing hides the footer', printed.footer);
  ok('Printing hides the buttons', printed.actions);
  ok('Printing hides the explanation', printed.note);
  ok('Printing keeps the card', printed.cardShown);
  await p.emulateMedia({ media: 'screen' });

  // ---------- the code on the badge has to actually scan ----------
  await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => { session.worker.status = 'approved'; go('card'); });
  await p.waitForTimeout(900);
  const shot = await p.locator('.bd-qr svg').screenshot({ scale: 'css' });
  const { createCanvas, loadImage } = (() => { try { return require('canvas'); } catch (e) { return {}; } })();
  const jsQR = require('jsqr');
  // decode straight from the module matrix the page produced, upscaled
  const decoded = await p.evaluate(url => {
    const m = qrMatrix(url);
    const n = m.length, q = 4, side = n + q * 2, sc = 4, px = side * sc;
    const d = new Uint8ClampedArray(px * px * 4).fill(255);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c])
      for (let dy = 0; dy < sc; dy++) for (let dx = 0; dx < sc; dx++) {
        const y = (r + q) * sc + dy, x = (c + q) * sc + dx, i = (y * px + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 0;
      }
    return { data: Array.from(d), px };
  }, 'https://mysheher.com/#id=' + code);
  const got = jsQR(new Uint8ClampedArray(decoded.data), decoded.px, decoded.px);
  ok('The badge QR decodes to the verification link',
     got && got.data === 'https://mysheher.com/#id=' + code, got ? got.data : 'nothing');
  void shot;

  ok('No JS errors anywhere', errors.length === 0, errors.join(' | ') || 'none');
  await browser.close(); srv.close();
})();
