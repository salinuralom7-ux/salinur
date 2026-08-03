/* The side menu, the combined chat list, and the one-button photo step. */
const { chromium } = require('playwright');
const { silenceAccountOffer } = require('./helpers');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css',
           '.woff2':'font/woff2','.txt':'text/plain','.xml':'application/xml'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end('nope'); return; }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8816);

const ok = (label, cond, extra) => console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  /* The notification permission sheet opens over everything on a first visit
     and keeps asking until it is answered — that is deliberate, and it means
     it sits on top of the menu button this file is here to click. The gate is
     the real permission, not a localStorage flag, so the way to be a returning
     visitor is to have answered: grant it. test-notify-ask.js is where the
     sheet itself is checked. */
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8816' });
  await page.goto('http://localhost:8816/');
  await page.waitForTimeout(1200);
  /* and the one-off "create an account?" offer lands on top of the menu
     button too, for the same reason */
  await silenceAccountOffer(page);

  // ---------- the three-dot button ----------
  ok('Three-dot button in the header', await page.locator('#menuBtn').isVisible());
  ok('Menu starts closed', await page.locator('#drawer.open').count() === 0);
  ok('Legal links are no longer loose in the header',
     await page.locator('header .header-link').count() === 1);

  await page.locator('#menuBtn').click();
  await page.waitForTimeout(500);
  ok('Menu opens', await page.locator('#drawer.open').count() === 1);
  ok('Backdrop covers the page', await page.locator('#drawerBack.open').count() === 1);
  ok('Menu is announced open', await page.locator('#menuBtn').getAttribute('aria-expanded') === 'true');
  ok('Body scroll locked while open',
     await page.evaluate(() => getComputedStyle(document.body).overflow) === 'hidden');
  ok('Drawer sits fully on screen', await page.evaluate(() => {
    const r = document.getElementById('drawer').getBoundingClientRect();
    return r.right <= window.innerWidth + 1 && r.left >= 0 && r.height >= window.innerHeight - 1;
  }));

  const rows = (await page.locator('#drawer .drawer-row span:first-of-type, #drawer .drawer-row span')
    .allTextContents()).map(t => t.trim()).filter(Boolean);
  console.log('      menu:', [...new Set(rows)].join(' · '));
  for (const want of ['Bookings & chats', 'About us', 'Contact us', 'Privacy policy',
                      'Terms of use', 'Cancellations & refunds', 'Delete my account']) {
    ok(`"${want}" is in the menu`, rows.some(r => r === want));
  }

  // every page link in the menu actually resolves
  const hrefs = await page.locator('#drawer a[href]').evaluateAll(as => as.map(a => a.getAttribute('href')));
  const bad = [];
  for (const h of hrefs) {
    const res = await fetch('http://localhost:8816/' + h.split('#')[0]);
    if (!res.ok) bad.push(h + ' → ' + res.status);
  }
  ok('Every menu link resolves', bad.length === 0, bad.join(', ') || hrefs.length + ' links');

  // ---------- closing ----------
  await page.locator('#drawerBack').click({ position: { x: 20, y: 400 } });
  await page.waitForTimeout(450);
  ok('Tapping outside closes it', await page.locator('#drawer.open').count() === 0);

  await page.locator('#menuBtn').click(); await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok('Escape closes it', await page.locator('#drawer.open').count() === 0);

  await page.locator('#menuBtn').click(); await page.waitForTimeout(400);
  await page.goBack(); await page.waitForTimeout(450);
  ok('Back closes it instead of leaving the page',
     await page.locator('#drawer.open').count() === 0 &&
     await page.evaluate(() => (document.querySelector('.screen.on') || {}).id) === 'scr-home');

  await page.locator('#menuBtn').click(); await page.waitForTimeout(400);
  await page.locator('#drawer .drawer-x').click(); await page.waitForTimeout(450);
  ok('The X closes it', await page.locator('#drawer.open').count() === 0);

  // ---------- Bookings & chats ----------
  await page.locator('#menuBtn').click(); await page.waitForTimeout(400);
  await page.locator('#drawerChats').click(); await page.waitForTimeout(900);
  ok('Chats screen opens', await page.evaluate(() => (document.querySelector('.screen.on') || {}).id) === 'scr-chats');
  ok('Menu closed itself on the way', await page.locator('#drawer.open').count() === 0);
  ok('Empty state explains itself',
     (await page.locator('#chatsCard').innerText()).includes('No bookings yet'));
  await page.goBack(); await page.waitForTimeout(500);
  ok('One back press returns home',
     await page.evaluate(() => (document.querySelector('.screen.on') || {}).id) === 'scr-home');

  // a real preview conversation, seeded the way the app makes them
  const seeded = await page.evaluate(() => {
    const w = demoAll()[0];
    const t = demoStartThread({ workerId: w.id, skill: 'Plumber', mode: 'appointment',
      detail: 'Tomorrow morning', name: 'Test Customer', phone: '9876543210',
      area: 'Six Mile', price: 400, unit: 'per visit', note: 'Kitchen tap is leaking' });
    rememberBooking({ code: t.code, token: t.token, worker_name: t.worker_name,
                      skill: 'Plumber', created_at: new Date().toISOString() });
    return { code: t.code, worker: t.worker_name };
  });
  await page.evaluate(() => go('chats'));
  await page.waitForTimeout(1000);
  ok('The conversation is listed by who it is with',
     (await page.locator('#chatsCard').innerText()).includes(seeded.worker), seeded.worker);
  ok('It says which side of the job you were on',
     (await page.locator('.thread-row .tr-side i').first().innerText()).includes('you booked'));
  ok('No dot while nothing is unread for you', await page.evaluate(() =>
    document.getElementById('menuDot').hidden));
  // the worker replies: now there IS something to come back to
  await page.evaluate(code => demoPost(code, 'worker', 'On my way at 10.'), seeded.code);
  await page.evaluate(() => go('chats'));
  await page.waitForTimeout(900);
  ok('A reply lights the dot on the menu button', await page.evaluate(() =>
    !document.getElementById('menuDot').hidden));
  ok('…and counts it beside Bookings & chats', await page.evaluate(() => {
    const b = document.getElementById('chatsBadge');
    return !b.hidden && Number(b.textContent) >= 1;
  }));
  await page.locator('.thread-row').first().click();
  await page.waitForTimeout(1200);
  ok('Tapping it opens that conversation',
     await page.evaluate(() => (document.querySelector('.screen.on') || {}).id) === 'scr-chat');
  ok('The conversation names the worker',
     (await page.locator('#chatTitle').innerText()).includes(seeded.worker));
  await page.locator('.chat-back').click();
  await page.waitForTimeout(800);
  ok('Back from the conversation returns to the chat list',
     await page.evaluate(() => (document.querySelector('.screen.on') || {}).id) === 'scr-chats');

  // ---------- the photo step ----------
  await page.evaluate(() => {
    session = { phone: '9435019999', pin: '1111', name: 'Tester', registered: false };
    go('register');
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => regGo(2));      // the photo is step 2 of four
  await page.waitForTimeout(400);
  ok('One camera button, not four things', await page.locator('#photoBtn').count() === 1);
  ok('It says exactly "Open camera"', (await page.locator('#photoBtnLabel').innerText()).trim() === 'Open camera');
  ok('Upload fallback hidden until the camera fails', await page.locator('#uploadAlt').isVisible() === false);
  ok('The old circle-plus-paragraph block is gone',
     await page.locator('.selfie-row').count() === 0 && await page.locator('#selfieCircle').count() === 0);
  const words = (await page.locator('#photoBtn').innerText()).trim();
  ok('Nothing else written on the button', words === 'Open camera', JSON.stringify(words));
  const box = await page.locator('#photoBtn').boundingBox();
  ok('Big enough to be the obvious target', box.height >= 80 && box.width > 250,
     Math.round(box.width) + '×' + Math.round(box.height));

  // camera unavailable in headless: the fallback should appear, not silence
  await page.locator('#photoBtn').click();
  await page.waitForTimeout(900);
  ok('When the camera fails, the upload route appears', await page.locator('#uploadAlt').isVisible());
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DwnwEKmBhQAAAA//8DVgn+/hZorNMAAAAASUVORK5CYII=', 'base64');
  await page.setInputFiles('#selfieInput', { name: 's.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(700);
  ok('Photo shows on the button once taken', await page.locator('#photoThumb img').count() === 1);
  ok('And it offers to take it again', (await page.locator('#photoBtnLabel').innerText()).trim() === 'Take again');

  // ---------- nothing overflows anywhere ----------
  for (const w of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.evaluate(() => go('home'));
    await page.locator('#menuBtn').click();
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(`No horizontal overflow with the menu open at ${w}px`, !overflow);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => go('home'));
  await page.locator('#menuBtn').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: __dirname + '/shots/menu-open.png' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    session = { phone: '9435019999', pin: '1111', name: 'Tester', registered: false };
    go('register');
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => regGo(2));      // the photo is step 2 of four
  await page.waitForTimeout(400);
  await page.locator('#photoBtn').scrollIntoViewIfNeeded();
  await page.screenshot({ path: __dirname + '/shots/photo-step.png' });

  await b.close(); srv.close();
})();
