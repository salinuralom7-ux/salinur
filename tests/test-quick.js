const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
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

  ok('Eight one-tap tiles rendered', await p.locator('.qtile').count()===8);
  ok('Each tile has an icon', await p.locator('.qtile svg').count()===8);
  ok('Tiles sit four across',
     await p.evaluate(()=>new Set([...document.querySelectorAll('.qtile')]
        .map(e=>Math.round(e.getBoundingClientRect().top))).size===2));
  ok('No horizontal overflow', await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));

  await p.screenshot({path:'full-landing.png', fullPage:true});

  // a tile must land on results for that trade
  await p.locator('.qtile', {hasText:'Plumber'}).click();
  await p.waitForTimeout(1200);
  const q = await p.inputValue('#hireSearch');
  ok('Tapping a tile opens results for that trade',
     await p.locator('#scr-hire.on').count()===1 && q==='Plumber', 'search box = "'+q+'"');
  ok('No JS errors', errs.length===0, errs.join('|')||'none');
  await b.close(); srv.close();
})();
