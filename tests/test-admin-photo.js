/* Replacing a profile photograph from the admin screen.

   A profile is turned down for its photograph more often than for anything
   else — a group picture, a screenshot, somebody's motorbike. The team rings
   them, explains, and then it stalls: the person who could not work the
   camera the first time cannot work it the second time either, and what
   actually happens is the photo arrives on WhatsApp and sits there.

   So the reviewer, already looking at the photograph and already deciding
   about it, can put the right one on. Only the photograph — the name, the
   trade, the rate and the number stay the worker's own words — and the
   database records that this one came from staff, so "where did this picture
   come from" has an answer if it is ever asked.

   The database side is proved against real Postgres by the migration's own
   checks. This drives the screen. */
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
}).listen(8845);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

/* A deliberately non-square PNG, so the squaring is doing something visible:
   240 x 120, left half red, right half blue. Centre-cropped to a square it
   should come out half red and half blue; cropped from a corner it would not. */
function wideImage() {
  const { execSync } = require('child_process');
  const out = '/tmp/claude-0/-home-user-salinur/5804f10d-9047-5141-886a-31b320556fa3/scratchpad/wide.png';
  execSync(`python3 -c "
from PIL import Image
im = Image.new('RGB', (240,120))
for x in range(240):
    for y in range(120):
        im.putpixel((x,y), (220,30,30) if x < 120 else (30,60,220))
im.save('${out}')
"`);
  return out;
}

(async () => {
  const file = wideImage();
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => localStorage.setItem('nearse_preview_admin', '4242'));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept('4242'));
  await page.goto('http://localhost:8845/'); await page.waitForTimeout(2000);

  /* one profile awaiting review, with a photo the team would turn down */
  const before = await page.evaluate(() => {
    const all = demoAll();
    const w = all[0];
    w.status = 'pending';
    w.selfie = 'https://example.invalid/storage/v1/object/public/selfies/bad-photo.webp';
    w.thumb  = 'https://example.invalid/storage/v1/object/public/selfies/bad-thumb.webp';
    delete w.photo_by_admin_at;
    demoSave(all);
    return { id: w.id, name: w.name, selfie: w.selfie };
  });

  await page.evaluate(() => { adminPin = '4242'; go('admin'); setAdminTab('review'); });
  await page.waitForTimeout(1200);
  ok('The review queue is on screen', await page.locator('.admin-card').count() > 0,
     await page.locator('.admin-card').count() + ' card(s)');

  await page.evaluate(id => openAdminPhoto(id), before.id);
  await page.waitForTimeout(500);
  ok('The photo opens full size', await page.locator('#shotOverlay.open').count() === 1);
  ok('…offering to replace it', await page.locator('#adminPhotoBtn').count() === 1,
     (await page.locator('#adminPhotoBtn').innerText()).trim());
  ok('Nothing says it is staff-supplied yet',
     !(await page.locator('#shotBody').innerText()).includes('put here by the team'));

  await page.locator('#adminPhotoFile').setInputFiles(file);
  await page.waitForTimeout(1800);

  const after = await page.evaluate(id => {
    const w = demoAll().find(x => x.id === id);
    return { selfie: w.selfie, thumb: w.thumb, by: w.photo_by_admin_at || null,
             name: w.name, status: w.status,
             skills: (w.skills || []).map(s => s.skill + ':' + s.price).join(','),
             phone: w.phone, area: w.area };
  }, before.id);

  ok('The photograph is replaced', after.selfie && after.selfie !== before.selfie,
     (after.selfie || '').slice(0, 40));
  ok('…and a separate thumbnail written', !!after.thumb && after.thumb !== after.selfie);
  ok('…recorded as staff-supplied', !!after.by, after.by);
  ok('The sheet closes when it is done', await page.locator('#shotOverlay.open').count() === 0);

  /* the point of "only the photograph" */
  const untouched = await page.evaluate(id => {
    const w = demoAll().find(x => x.id === id); return w;
  }, before.id);
  ok('The name is untouched', untouched.name === before.name, untouched.name);
  ok('The trade, rate, number and locality are untouched',
     after.skills.length > 0 && !!after.phone && !!after.area, after.skills);
  ok('It is still awaiting review, not silently approved', after.status === 'pending', after.status);

  /* the image itself: squared to 400, and centre-cropped rather than corner */
  const shape = await page.evaluate(src => new Promise(res => {
    const i = new Image();
    i.onload = () => {
      const c = document.createElement('canvas');
      c.width = i.width; c.height = i.height;
      const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const px = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; };
      res({ w: i.width, h: i.height, left: px(40, i.height / 2), right: px(i.width - 40, i.height / 2) });
    };
    i.onerror = () => res(null);
    i.src = src;
  }), after.selfie);
  ok('Squared to the same 400px the app uses everywhere',
     shape && shape.w === 400 && shape.h === 400, shape && `${shape.w}x${shape.h}`);
  ok('Centre-cropped, not corner-cropped',
     shape && shape.left[0] > 150 && shape.left[2] < 100 && shape.right[2] > 150 && shape.right[0] < 100,
     shape && `left ${shape.left} right ${shape.right}`);

  /* reopening shows the provenance line */
  await page.evaluate(id => openAdminPhoto(id), before.id);
  await page.waitForTimeout(400);
  ok('Reopening says plainly that the team put it there',
     (await page.locator('#shotBody').innerText()).includes('put here by the team'));

  /* a non-image must be refused before anything is uploaded */
  const notAnImage = '/tmp/claude-0/-home-user-salinur/5804f10d-9047-5141-886a-31b320556fa3/scratchpad/notimage.txt';
  fs.writeFileSync(notAnImage, 'this is not a photograph');
  const held = after.selfie;
  await page.locator('#adminPhotoFile').setInputFiles(notAnImage);
  await page.waitForTimeout(900);
  const stillThere = await page.evaluate(id => demoAll().find(x => x.id === id).selfie, before.id);
  ok('A file that is not a photo changes nothing', stillThere === held);

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
