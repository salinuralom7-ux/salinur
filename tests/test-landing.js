const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT='/home/user/salinur/docs';
const T={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('nf');return;}
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8805);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  for (const [label, w, h] of [['iPhone SE',375,667],['iPhone 14',390,844],['tablet',768,1024],['laptop',1280,860],['wide',1600,900]]) {
    const ctx=await b.newContext({viewport:{width:w,height:h}});
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8805/'); await p.waitForTimeout(1400);
    const o = await p.evaluate(() => {
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      const wide = [...document.querySelectorAll('#scr-home *')]
        .filter(e => e.getBoundingClientRect().right > window.innerWidth + 1)
        .map(e => e.tagName + '.' + (e.className||'').toString().split(' ')[0]);
      const figs = [...document.querySelectorAll('.fig')].map(f => f.getBoundingClientRect().top);
      const stepEls = [...document.querySelectorAll('.stepbar li')];
      const steps = stepEls.map(f => Math.round(f.getBoundingClientRect().top));
      return { overflow, wide: [...new Set(wide)].slice(0,4),
               figRows: new Set(figs.map(t=>Math.round(t))).size,
               stepCount: stepEls.length,
               stepCols: stepEls.length && new Set(steps).size === 1 ? 3 : 1,
               stepsPx: Math.round((document.querySelector('.steps')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height),
               pagePx: document.documentElement.scrollHeight,
               ticks: document.querySelectorAll('.tick').length,
               services: document.getElementById('figServices').textContent,
               areas: document.getElementById('figAreas').textContent };
    });
    console.log(`${label.padEnd(10)} ${String(w).padStart(4)}px  overflow:${o.overflow?'YES':'no '}  figures on ${o.figRows} row  steps ${o.stepCount}-in-${o.stepCols}-across (${o.stepsPx}px)  page ${o.pagePx}px  ticker chips ${o.ticks}` +
                (o.wide.length ? `  bleeding: ${o.wide.join(', ')}` : ''));
    if (errs.length) console.log('   errors:', errs);
    await ctx.close();
  }
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage(); await p.goto('http://localhost:8805/'); await p.waitForTimeout(1400);
  console.log('\nFigures read from the real catalogue:',
    await p.evaluate(()=>document.getElementById('figServices').textContent + ' services, ' +
                        document.getElementById('figAreas').textContent + ' localities'));
  /* This used to read .reveal, the rise-in animation on the two landing
     doors. Both doors are gone and nothing carries that class any more, so
     querySelector returned null and getComputedStyle threw — taking the
     whole file down before it printed a single line. The property worth
     keeping is the one the old check was after: with reduced motion asked
     for, nothing on the home screen is mid-animation, and everything on it
     is visible. */
  console.log('Home screen is fully opaque:', await p.evaluate(()=>
    [...document.querySelectorAll('#scr-home .qtile, #scr-home .see-all, #scr-home h1')]
      .every(e => getComputedStyle(e).opacity === '1')));
  const rm = await b.newContext({viewport:{width:390,height:844}, reducedMotion:'reduce'});
  const p2 = await rm.newPage(); await p2.goto('http://localhost:8805/'); await p2.waitForTimeout(900);
  console.log('With prefers-reduced-motion, the home screen is visible and still:',
    await p2.evaluate(()=>{
      const els=[...document.querySelectorAll('#scr-home .qtile, #scr-home .see-all, #scr-home h1')];
      return els.length > 0
        && els.every(e => getComputedStyle(e).opacity === '1')
        && els.every(e => {
             const d = getComputedStyle(e).animationDuration;
             return d === '0s' || parseFloat(d) < 0.01;
           });
    }));
  await b.close(); srv.close();
})();
