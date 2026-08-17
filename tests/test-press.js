/* How the home screen feels under a thumb.

   This file was written for the two big doors — Hire somebody / Work with us
   — and every assertion pointed at #ctaHire and #ctaWork. The home screen was
   rebuilt around a grid of twelve trades and one button, both doors went, and
   this file spent thirty seconds waiting for a locator that could never
   appear before dying with a timeout.

   What it was actually guarding is worth keeping, so it now points at what is
   there: a tile is big enough to hit, says so when pressed, does not flash
   Android grey, does not wait 300ms, and the first two rows are reachable
   without scrolling. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT='/home/user/salinur/docs';
const T={'.html':'text/html','.css':'text/css','.png':'image/png','.woff2':'font/woff2',
         '.js':'application/javascript','.webmanifest':'application/manifest+json','.webp':'image/webp'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const f=path.join(ROOT,p); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8827);
const ok=(l,c,x)=>{console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));
                   if(!c) process.exitCode=1;};

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8827/'); await p.waitForTimeout(1500);

  /* One tile and the button underneath it: the only two things on this screen
     anybody presses. */
  for(const [name, sel] of [['A trade tile','.qtile'], ['See all services','.see-all']]){
    await p.goto('http://localhost:8827/'); await p.waitForTimeout(1300);   // pressing navigates
    const el = p.locator(sel).first();
    const box = await el.boundingBox();
    /* A tile is square-ish and photograph-led, so it clears 64 easily; the
       button is a button. Both have to clear the size at which a thumb stops
       missing. */
    ok(`${name} is a comfortable thumb target (>=48px tall)`, box.height>=48, Math.round(box.height)+'px');
    ok(`${name} is wide enough too (>=48px)`, box.width>=48, Math.round(box.width)+'px');

    const rest=await el.evaluate(e=>getComputedStyle(e).transform);
    await p.mouse.move(box.x+box.width/2, box.y+box.height/2);
    await p.mouse.down();
    await p.waitForTimeout(200);
    const down=await el.evaluate(e=>getComputedStyle(e).transform);
    await p.mouse.up();
    ok(`${name} visibly depresses when pressed`, down!==rest, down);
    ok(`${name} kills the grey Android tap flash`,
       (await el.evaluate(e=>getComputedStyle(e).webkitTapHighlightColor))==='rgba(0, 0, 0, 0)');
    ok(`${name} has no 300ms tap delay`,
       (await el.evaluate(e=>getComputedStyle(e).touchAction))==='manipulation');
  }

  await p.goto('http://localhost:8827/'); await p.waitForTimeout(1400);
  /* The first two rows were the two doors. They are eight trades now, and the
     same rule holds: somebody opening the app can act without scrolling. */
  const fold=await p.evaluate(()=>{
    const t=[...document.querySelectorAll('.qtile')];
    return {eighth: t[7] ? Math.round(t[7].getBoundingClientRect().bottom) : -1,
            screen: window.innerHeight, n: t.length};
  });
  ok('The first two rows land on the first screen, no scrolling',
     fold.eighth > 0 && fold.eighth <= fold.screen, fold.eighth+' / '+fold.screen);

  ok('Tile labels stay on one line',
     await p.evaluate(()=>[...document.querySelectorAll('.qt-label')]
        .every(e=>e.getBoundingClientRect().height < 24)));
  ok('…and none of them is cut off mid-word',
     await p.evaluate(()=>[...document.querySelectorAll('.qt-label')]
        .every(e=>e.scrollWidth <= e.clientWidth + 1)),
     await p.evaluate(()=>[...document.querySelectorAll('.qt-label')]
        .filter(e=>e.scrollWidth > e.clientWidth + 1).map(e=>e.textContent).join(', ') || 'none cut'));
  ok('Every tile in a row is the same height',
     await p.evaluate(()=>{
       const h=[...document.querySelectorAll('.qtile')].slice(0,4)
         .map(e=>e.getBoundingClientRect().height);
       return Math.max(...h) - Math.min(...h) < 1;
     }));

  ok('A tile still opens results', await (async()=>{
      await p.locator('.qtile').first().click(); await p.waitForTimeout(900);
      return await p.locator('#scr-hire.on').count()===1;})());
  await p.goto('http://localhost:8827/'); await p.waitForTimeout(1300);
  ok('See all services still opens the full list', await (async()=>{
      await p.locator('.see-all').click(); await p.waitForTimeout(900);
      return await p.locator('#scr-hire.on').count()===1;})());

  ok('No JS errors', errs.length===0, errs.join('|')||'none');
  await b.close(); srv.close();
})();
