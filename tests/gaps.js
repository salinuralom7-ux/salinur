const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT='/home/user/salinur/docs';
const T={'.html':'text/html','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.js':'application/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const f=path.join(ROOT,p); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8829);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:402,height:874},reducedMotion:'reduce'});  // iPhone 16 CSS px
  await p.goto('http://localhost:8829/'); await p.waitForTimeout(1500);
  const rows = await p.evaluate(()=>{
    const sel = ['.city-pill','.landing h1','.landing .sub','.doors','.quick','.figures','.ticker',
                 '.steps .row-label','.stepbar','.assure','footer','.foot-reach','.foot-fine'];
    const out=[]; let prev=null;
    for(const s of sel){
      const e=document.querySelector(s); if(!e) { out.push([s,'MISSING']); continue; }
      const r=e.getBoundingClientRect();
      const top=Math.round(r.top+scrollY), bot=Math.round(r.bottom+scrollY);
      out.push([s, top, bot, Math.round(r.height), prev===null?'-':top-prev]);
      prev=bot;
    }
    return {out, page:document.documentElement.scrollHeight, vh:innerHeight};
  });
  console.log('section'.padEnd(20),'top'.padStart(6),'bottom'.padStart(7),'height'.padStart(7),'  GAP above');
  for(const r of rows.out){
    if(r[1]==='MISSING'){ console.log(r[0].padEnd(20),' MISSING'); continue; }
    const gap = r[4]==='-'?'-':r[4];
    console.log(r[0].padEnd(20), String(r[1]).padStart(6), String(r[2]).padStart(7), String(r[3]).padStart(7),
                '  '+String(gap).padStart(5) + (typeof gap==='number'&&gap>=40?'   <-- big':''));
  }
  console.log('\npage height', rows.page, ' viewport', rows.vh);
  await b.close(); srv.close();
})();
