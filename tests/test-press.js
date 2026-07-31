const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT='/home/user/salinur/docs';
const T={'.html':'text/html','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.js':'application/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const f=path.join(ROOT,p); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8827);
const ok=(l,c,x)=>console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8827/'); await p.waitForTimeout(1400);

  for(const id of ['#ctaHire','#ctaWork']){
    await p.goto('http://localhost:8827/'); await p.waitForTimeout(1200);   // pressing navigates
    const box=await p.locator(id).boundingBox();
    ok(`${id} is a comfortable thumb target (>=64px tall)`, box.height>=64, Math.round(box.height)+'px');
    const rest=await p.locator(id).evaluate(e=>getComputedStyle(e).transform);
    await p.mouse.move(box.x+box.width/2, box.y+box.height/2);
    await p.mouse.down();
    await p.waitForTimeout(160);
    const down=await p.locator(id).evaluate(e=>getComputedStyle(e).transform);
    await p.mouse.up();
    ok(`${id} visibly depresses when pressed`, down!==rest, down);
    ok(`${id} kills the grey Android tap flash`,
       (await p.locator(id).evaluate(e=>getComputedStyle(e).webkitTapHighlightColor))==='rgba(0, 0, 0, 0)');
    ok(`${id} has no 300ms tap delay`,
       (await p.locator(id).evaluate(e=>getComputedStyle(e).touchAction))==='manipulation');
    ok(`${id} arrow sits in its own chip`, await p.locator(id+' .cta-go').count()===1);
  }
  await p.goto('http://localhost:8827/'); await p.waitForTimeout(1300);
  const fold=await p.evaluate(()=>{
    const w=document.querySelector('#ctaWork').getBoundingClientRect();
    return {bottom:Math.round(w.bottom), screen:window.innerHeight};
  });
  ok('Both doors land on the first screen, no scrolling', fold.bottom<=fold.screen, fold.bottom+' / '+fold.screen);
  ok('Subtitles stay on one line',
     await p.evaluate(()=>[...document.querySelectorAll('.cta-text i')]
        .every(e=>e.getBoundingClientRect().height < 24)));
  ok('Both doors are the same height',
     await p.evaluate(()=>{const a=document.querySelector('#ctaHire').getBoundingClientRect().height,
        b=document.querySelector('#ctaWork').getBoundingClientRect().height; return Math.abs(a-b)<1;}));
  ok('Buttons still work', await (async()=>{await p.locator('#ctaHire').click();await p.waitForTimeout(700);
      return await p.locator('#scr-hire.on').count()===1;})());
  ok('No JS errors', errs.length===0, errs.join('|')||'none');
  await b.close(); srv.close();
})();
