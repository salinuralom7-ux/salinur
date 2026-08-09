/* The one-tap tiles carry a photograph now. Two things have to hold: a tile
   with a picture shows it, a tile without one still looks finished, and both
   land on the right search. */
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT='/home/user/salinur/docs';
const T={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.css':'text/css','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8841);
const ok=(l,c,x)=>{console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));if(!c)process.exitCode=1;};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await (await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})).newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  const missing=[]; page.on('response',r=>{ if(r.status()===404 && /\/cat\//.test(r.url())) missing.push(r.url().split('/').pop()); });
  await page.goto('http://localhost:8841/'); await page.waitForTimeout(1600);

  const n = await page.locator('.qtile').count();
  ok('Twelve tiles', n === 12, n + '');

  ok('Every tile says what it is',
     (await page.locator('.qt-label').allTextContents()).every(t => t.trim().length > 0));

  // the doctor has a photograph
  const doc = page.locator('.qtile', { hasText: 'Doctor' });
  ok('The doctor tile is there', await doc.count() === 1);
  const shown = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.qtile')].find(x => /Doctor/.test(x.textContent));
    const img = b && b.querySelector('.qt-pic img');
    return img ? { w: img.naturalWidth, h: img.naturalHeight, src: img.getAttribute('src') } : null;
  });
  ok('…and its photograph actually loaded', shown && shown.w > 0 && shown.h > 0,
     shown ? `${shown.src} ${shown.w}x${shown.h}` : 'no img element left');

  // a tile with no photograph yet keeps its icon and drops the broken image
  const fallback = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.qtile')].find(x => /Plumber/.test(x.textContent));
    return { img: !!b.querySelector('.qt-pic img'), icon: !!b.querySelector('.qt-pic svg') };
  });
  ok('A tile with no picture yet drops the broken image', fallback.img === false);
  ok('…and still shows its icon', fallback.icon === true);

  // and it goes somewhere
  await doc.click(); await page.waitForTimeout(1200);
  ok('Tapping the doctor opens the results', await page.locator('#scr-hire.on').count() === 1);
  const q = await page.inputValue('#hireSearch');
  ok('…searching for that trade', /physician/i.test(q), q);

  ok('No horizontal overflow',
     await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok('No JS errors', errs.length === 0, errs.join(' | ') || 'none');
  console.log('      (pictures still to come: ' + (missing.join(', ') || 'none') + ')');
  await b.close(); srv.close();
})();
