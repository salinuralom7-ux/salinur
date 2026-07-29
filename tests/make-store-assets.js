/* Play Store phone screenshots (1080x1920) and the 1024x500 feature graphic,
   rendered from the real app so they can never drift from what ships. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const OUT  = ROOT + '/store';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8814);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // 1080x1920 at dpr 3 = a 360x640 CSS viewport, which is a real phone shape
  const ctx = await b.newContext({
    viewport: { width: 360, height: 640 }, deviceScaleFactor: 3,
    geolocation: { latitude: 26.1445, longitude: 91.7362 }, permissions: ['geolocation'],
    reducedMotion: 'reduce',   // the app honours this and paints without the entrance animation
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
  await page.goto('http://localhost:8814/');
  await page.waitForTimeout(1600);

  const shot = async (name) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/screen-${name}.png` });
    console.log('screen-' + name + '.png');
  };

  await shot('home');

  await page.evaluate(() => go('hire'));
  await page.waitForTimeout(1400);
  await shot('browse');

  await page.locator('.wcard').first().click();
  await page.waitForTimeout(700);
  await shot('worker');

  await page.evaluate(() => { closeModal('wOverlay'); go('work'); });
  await page.waitForTimeout(700);
  await shot('register');

  await page.evaluate(() => go('hire'));
  await page.waitForTimeout(1000);
  await page.fill('#hireSearch', 'electrician');
  await page.waitForTimeout(700);
  await shot('search');

  // ---- feature graphic, 1024x500 ----
  const fgCtx = await b.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const fg = await fgCtx.newPage();
  const logo = 'data:image/png;base64,' + fs.readFileSync(ROOT + '/icons/logo.png').toString('base64');
  const word = 'data:image/png;base64,' + fs.readFileSync(ROOT + '/icons/wordmark.png').toString('base64');
  await fg.setContent(`<!doctype html><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:1024px;height:500px;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;
      background:radial-gradient(760px 420px at 78% -18%, rgba(234,187,81,.20), transparent 62%),
                 radial-gradient(560px 320px at -4% 108%, rgba(234,187,81,.10), transparent 60%), #0C0A07;
      color:#F6F2E8;display:flex;align-items:center;padding:0 64px;gap:38px}
    .lockup{display:flex;flex-direction:column;align-items:center;gap:18px;flex:0 0 auto}
    .mark{width:118px;height:auto;filter:drop-shadow(0 14px 34px rgba(0,0,0,.55))}
    .word{width:150px;height:auto}
    h1{font-size:50px;font-weight:800;letter-spacing:-.03em;line-height:1.1;white-space:nowrap}
    em{font-style:normal;color:#EABB51}
    p{margin-top:14px;font-size:21px;color:#D8D0BE;line-height:1.5;max-width:690px}
    .row{margin-top:24px;display:flex;gap:10px;flex-wrap:nowrap}
    .chip{border:1px solid rgba(246,242,232,.20);border-radius:999px;padding:8px 16px;white-space:nowrap;
      font-size:15px;font-weight:600;color:#C4B48C}
    .chip.on{background:#EABB51;border-color:#EABB51;color:#14100A;font-weight:800}
  </style>
  <div class="lockup"><img class="mark" src="${logo}" alt=""><img class="word" src="${word}" alt=""></div>
  <div>
    <h1>Trusted people for every job,<br><em>right where you are.</em></h1>
    <p>Verified local workers across Guwahati. They set their price, you keep the whole conversation.</p>
    <div class="row">
      <span class="chip on">0% commission</span>
      <span class="chip">155 services</span>
      <span class="chip">124 localities</span>
      <span class="chip">Checked by a person</span>
    </div>
  </div>`);
  await fg.waitForTimeout(1800);
  await fg.screenshot({ path: OUT + '/feature-graphic.png' });
  console.log('feature-graphic.png');

  await b.close(); srv.close();
})();
