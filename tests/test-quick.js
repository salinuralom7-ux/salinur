const { chromium } = require('playwright');
const http = require('http');
require('fs').mkdirSync('tests/shots', { recursive: true }); const fs = require('fs'); const path = require('path');
const ROOT='/home/user/salinur/docs';
const T={'.html':'text/html','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.js':'application/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const f=path.join(ROOT,p); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8831);
const ok=(l,c,x)=>console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:402,height:874},reducedMotion:'reduce',hasTouch:true});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8831/'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{const n=document.getElementById('demoNote'); if(n) n.style.display='none';});

  /* Eight when this was written, twelve now — the home screen was rebuilt
     around the grid. Read the count off the list the app actually renders
     from, so growing it is a one-line change there and not a failure here,
     and keep the properties that matter: four across, and never a tile with
     nothing drawn in it. */
  const n = await p.evaluate(()=>QUICK_PICKS.length);
  ok(`${n} one-tap tiles rendered`, await p.locator('.qtile').count()===n, n);
  ok('Each tile has an icon', await p.locator('.qtile svg').count()===n);
  ok('Tiles sit four across',
     await p.evaluate(()=>{
       const tops=[...document.querySelectorAll('.qtile')].map(e=>Math.round(e.getBoundingClientRect().top));
       const rows=new Set(tops).size;
       return rows===Math.ceil(tops.length/4);
     }));
  /* The first two rows are above the fold and are fetched eagerly on
     purpose; the rest wait for the scroll. Getting that backwards is what
     made the grid fill in tile by tile after the layout had settled. */
  ok('The rows above the fold do not wait for the scroll',
     await p.evaluate(()=>{
       const imgs=[...document.querySelectorAll('.qtile img')];
       return imgs.slice(0,8).every(i=>i.getAttribute('loading')==='eager')
           && imgs.slice(8).every(i=>i.getAttribute('loading')==='lazy');
     }));
  ok('No horizontal overflow', await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));

  await p.screenshot({path:'tests/shots/full-landing.png', fullPage:true});

  // a tile must land on results for that trade
  await p.locator('.qtile', {hasText:'Plumber'}).click();
  await p.waitForTimeout(1200);
  const q = await p.inputValue('#hireSearch');
  ok('Tapping a tile opens results for that trade',
     await p.locator('#scr-hire.on').count()===1 && q==='Plumber', 'search box = "'+q+'"');
  ok('No JS errors', errs.length===0, errs.join('|')||'none');
  await b.close(); srv.close();
})();
