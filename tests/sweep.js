/* Walks every screen and sheet at phone size and writes a screenshot of each,
   so they can be looked at rather than reasoned about. Also reports, per
   screen, how much text it puts in front of somebody and how many things they
   can press — the two numbers that tell you a screen is doing too much. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const OUT = __dirname + '/shots/sweep';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css',
           '.woff2':'font/woff2','.txt':'text/plain','.xml':'application/xml'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8818);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce',
    geolocation: { latitude: 26.1445, longitude: 91.7362 }, permissions: ['geolocation'],
  });
  await ctx.addInitScript(() => localStorage.setItem('nearse_preview_admin', '4242'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept('4242'));
  await page.goto('http://localhost:8818/');
  await page.waitForTimeout(1400);

  const rows = [];
  async function shot(name, note) {
    await page.waitForTimeout(450);
    const m = await page.evaluate(() => {
      const on = document.querySelector('.overlay.open') || document.querySelector('.screen.on');
      if (!on) return null;
      const txt = (on.innerText || '').replace(/\s+/g, ' ').trim();
      const press = on.querySelectorAll('button, a[href], input, select, textarea, [role=button]').length;
      return { words: txt.split(' ').filter(Boolean).length, press,
               tall: Math.round(on.scrollHeight / window.innerHeight * 10) / 10 };
    });
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    rows.push({ name, ...(m || {}), note: note || '' });
  }

  // ---- landing ----
  await shot('01-home');

  // ---- customer journey ----
  await page.evaluate(() => go('hire')); await page.waitForTimeout(1200);
  await shot('02-browse');
  await page.fill('#hireSearch', 'electrician'); await page.waitForTimeout(700);
  await shot('03-search');
  await page.locator('.wcard').first().click(); await page.waitForTimeout(600);
  await shot('04-worker-sheet');
  await page.locator('.report-link').click(); await page.waitForTimeout(500);
  await shot('05-report');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.locator('.wcard').first().click(); await page.waitForTimeout(500);
  const bookBtn = page.locator('#wDetail .btn-brand').first();
  if (await bookBtn.count()) { await bookBtn.click(); await page.waitForTimeout(700); await shot('06-booking'); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // ---- worker journey ----
  await page.evaluate(() => go('work')); await page.waitForTimeout(600);
  await shot('07-signin');
  await page.locator('#tabUp').click(); await page.waitForTimeout(400);
  await shot('08-signup');
  await page.fill('#upName', 'Sweep Tester');
  await page.fill('#upPhone', '9435012345');
  await page.fill('#upPin', '4321');
  await page.locator('#signUpBtn').click(); await page.waitForTimeout(900);
  await shot('09-verify-number');
  const waBtn = page.locator('#waSendBtn');
  if (await waBtn.count()) {
    await page.evaluate(() => markWaOpened());
    await page.locator('#waDoneBtn').click(); await page.waitForTimeout(900);
  }
  await shot('10-register-top');
  await page.evaluate(() => window.scrollTo(0, 700)); await shot('11-register-mid');
  await page.evaluate(() => window.scrollTo(0, 99999)); await shot('12-register-bottom');

  // fill it in and publish, so the later screens have something in them
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.fill('#skillSearch', 'electric'); await page.waitForTimeout(500);
  const svc = page.locator('.svc-row').first();
  if (await svc.count()) { await svc.click(); await page.waitForTimeout(500); }
  const price = page.locator('.sd-price').first();
  if (await price.count()) await price.fill('450');
  await page.locator('#photoBtn').click(); await page.waitForTimeout(800);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DwnwEKmBhQAAAA//8DVgn+/hZorNMAAAAASUVORK5CYII=', 'base64');
  await page.setInputFiles('#selfieInput', { name: 's.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(600);
  await page.selectOption('#regArea', 'Jalukbari').catch(()=>{});
  await page.locator('#consentPublish').check().catch(()=>{});
  await page.locator('#consentAge').check().catch(()=>{});
  await page.locator('#regSaveBtn').click(); await page.waitForTimeout(1400);
  await shot('13-submitted');
  await page.evaluate(() => go('me')); await page.waitForTimeout(900);
  await shot('14-my-profile');
  await page.evaluate(() => window.scrollTo(0, 99999)); await shot('15-my-profile-bottom');
  await page.evaluate(() => go('card')); await page.waitForTimeout(1000);
  await shot('16-id-card');
  await page.evaluate(() => go('inbox')); await page.waitForTimeout(1000);
  await shot('17-my-work');
  await page.evaluate(() => go('verify')); await page.waitForTimeout(600);
  await shot('18-verify-id');
  await page.evaluate(() => go('chats')); await page.waitForTimeout(900);
  await shot('19-chats-empty');

  // ---- menu ----
  await page.evaluate(() => go('home')); await page.waitForTimeout(500);
  await page.locator('#menuBtn').click(); await page.waitForTimeout(600);
  await shot('20-menu');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // ---- admin ----
  await page.evaluate(() => { adminPin = '4242'; go('admin'); renderAdmin(); });
  await page.waitForTimeout(1600);
  await shot('21-admin-top');
  await page.evaluate(() => window.scrollTo(0, 900)); await shot('22-admin-mid');

  console.log('\nscreen                 words  press  screens-tall');
  console.log('─'.repeat(56));
  for (const r of rows) {
    const flag = (r.words > 180 ? ' ← wordy' : '') + (r.press > 28 ? ' ← busy' : '') + (r.tall > 3 ? ' ← long' : '');
    console.log(`${r.name.padEnd(22)} ${String(r.words).padStart(5)} ${String(r.press).padStart(6)} ${String(r.tall).padStart(12)}${flag}`);
  }
  console.log('\nJS errors:', errors.length ? errors.join(' | ') : 'none');
  await b.close(); srv.close();
})();
