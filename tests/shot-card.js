/* Renders the worker ID card at the reference image's proportions so it can be
   compared side by side with the design it is meant to match. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8817);

const OUT = '/tmp/claude-0/-home-user-salinur/5804f10d-9047-5141-886a-31b320556fa3/scratchpad/';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];

  for (const [name, w, dpr] of [['card-wide', 900, 2], ['card-phone', 390, 3]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.goto('http://localhost:8817/');
    await page.waitForTimeout(1200);

    // sign a worker in locally and open the card screen
    await page.evaluate(() => {
      const all = JSON.parse(localStorage.getItem('nearse_workers_v1') || '[]');
      const me = all[0] || {};
      me.name = 'Salinur Pramanik';
      me.phone = '7086599367';
      me.area = 'Fancy Bazar'; me.city = 'Guwahati';
      me.worker_code = '482739105566';
      me.status = 'approved'; me.verified = true;
      me.created_at = '2025-05-04T00:00:00.000Z';
      me.skills = [{skill:'App Developer', price:40000, unit:'per project'}];
      all[0] = me;
      localStorage.setItem('nearse_workers_v1', JSON.stringify(all));
      session = { phone: me.phone, pin: me.pin || '0000', name: me.name, registered: true, worker: me };
      saveSession();
    });
    await page.evaluate(() => { if (typeof go === 'function') go('card'); });
    await page.waitForTimeout(900);

    if (name === 'card-wide') {
      await page.evaluate(() => { session.worker = {...session.worker, status:'pending', verified:false}; renderCard(); });
      await page.waitForTimeout(400);
      const pend = await page.$('#idCard');
      await pend.screenshot({ path: OUT + 'card-pending.png' });
      await page.evaluate(() => { session.worker = {...session.worker, status:'approved', verified:true}; renderCard(); });
      await page.waitForTimeout(400);
    }
    const card = await page.$('#idCard');
    if (!card) { console.log(name + ': NO CARD — screen id may differ'); await ctx.close(); continue; }
    await card.screenshot({ path: OUT + name + '.png' });
    const box = await card.boundingBox();
    console.log(name.padEnd(12), Math.round(box.width) + 'x' + Math.round(box.height),
                'ratio ' + (box.width / box.height).toFixed(3), '(reference 1.585)');
    await ctx.close();
  }
  console.log('JS errors:', errors.length ? errors.join(' | ') : 'none');
  await b.close(); srv.close();
})();
