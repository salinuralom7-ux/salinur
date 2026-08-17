// Serve docs/ exactly like GitHub Pages and verify the app (PWA) layer.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/user/salinur/docs';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.png':'image/png', '.svg':'image/svg+xml',
  '.txt':'text/plain', '.xml':'application/xml', '.sql':'text/plain' };

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
}).listen(8790);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:8790/');
  await page.waitForTimeout(1500);

  // manifest
  const mfHref = await page.getAttribute('link[rel="manifest"]', 'href');
  const mf = await (await fetch('http://localhost:8790/' + mfHref)).json();
  console.log('Manifest name:', mf.name);
  console.log('Manifest display/scope/start:', mf.display, mf.scope, mf.start_url);
  console.log('Manifest icons:', mf.icons.map(i => i.sizes + ' ' + i.purpose).join(', '));
  console.log('Theme colour:', mf.theme_color);

  for (const i of mf.icons.concat([{src:'icons/apple-touch-icon.png'}])) {
    const r = await fetch('http://localhost:8790/' + i.src);
    console.log('  icon', i.src, '→ HTTP', r.status, r.headers.get('content-type'));
  }

  // service worker
  await page.waitForTimeout(1200);
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? (reg.active ? 'active' : (reg.installing ? 'installing' : 'waiting')) : 'none';
  });
  console.log('Service worker:', swState);

  // offline: app shell must still load
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  const off = await ctx.newPage();
  let offlineOK = false;
  try {
    await off.goto('http://localhost:8790/', { timeout: 15000 });
    await off.waitForTimeout(1200);
    /* Two .cta doors were the landing screen. It is a grid of trades now:
       the shell has loaded when the tiles are there and one of them can be
       pressed, which is also the only thing worth being able to do with no
       signal. */
    offlineOK = (await off.locator('.qtile').count()) > 0
             && (await off.locator('.see-all').count()) === 1;
  } catch (e) { offlineOK = false; }
  console.log('Works offline (app shell):', offlineOK);
  await off.close();
  await ctx.setOffline(false);

  // the policy pages must not poison the cached app shell
  const priv = await ctx.newPage();
  await priv.goto('http://localhost:8790/privacy/');
  await priv.waitForTimeout(1200);
  console.log('Privacy page title:', await priv.title());
  await priv.close();
  await page.waitForTimeout(800);
  const shell = await ctx.newPage();
  await ctx.setOffline(true);
  let shellTitle = 'FAILED';
  try { await shell.goto('http://localhost:8790/', { timeout: 15000 }); shellTitle = await shell.title(); } catch (e) {}
  console.log('App shell offline is still the app:', shellTitle);
  let privOffline = 'not cached';
  try { const p2 = await ctx.newPage(); await p2.goto('http://localhost:8790/privacy/', { timeout: 15000 }); privOffline = await p2.title(); await p2.close(); } catch (e) {}
  console.log('Privacy page offline:', privOffline);
  await ctx.setOffline(false);
  await shell.close();


  // install button appears when the browser offers installation
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt');
    e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.waitForTimeout(300);
  console.log('Install button shows on prompt:', await page.locator('#installBtn').isVisible());

  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
  srv.close();
})();
