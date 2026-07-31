const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT='/home/user/salinur/docs';
const T={'.html':'text/html','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.js':'application/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const f=path.join(ROOT,p); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8845);
const ok=(l,c,x)=>console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',
    geolocation:{latitude:26.1445,longitude:91.7362},permissions:['geolocation']});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const toast=async()=>(await p.locator('#toast').innerText().catch(()=>'')).trim();
  const step=()=>p.evaluate(()=>regStep);

  await p.goto('http://localhost:8845/'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ session={phone:'9435019009',pin:'1234',name:'Test Worker',registered:false}; go('register'); });
  await p.waitForTimeout(900);

  ok('Opens on step 1 of 4', await step()===1);
  ok('Only one step is on screen', await p.locator('#scr-register .regstep:visible').count()===1);
  ok('Progress is shown', await p.locator('.sdot').count()===4);
  ok('The step has a plain-language title', (await p.locator('#regStepTitle').innerText()).length>5,
     await p.locator('#regStepTitle').innerText());
  ok('Back is hidden on the first step', await p.locator('#stepBack:visible').count()===0);
  ok('Publish is not reachable yet', await p.locator('#regSaveBtn:visible').count()===0);
  ok('Categories carry an icon', await p.locator('.cat-tile .ct-ico').count()>=16);

  // cannot skip ahead empty-handed
  await p.locator('#stepNext').click(); await p.waitForTimeout(400);
  ok('Cannot leave step 1 without picking work', await step()===1);
  ok('…and it says why, in words', (await toast()).length>5, await toast());

  // pick a trade
  await p.locator('.cat-tile', {hasText:'Repairs & Appliances'}).click(); await p.waitForTimeout(400);
  await p.locator('.svc-row', {hasText:'Electrician'}).first().click(); await p.waitForTimeout(500);
  await p.locator('#stepNext').click(); await p.waitForTimeout(400);
  ok('Still held back until a rate is set', await step()===1, await toast());

  await p.locator('.picked-card .sd-price').first().fill('400'); await p.waitForTimeout(300);
  await p.locator('#stepNext').click(); await p.waitForTimeout(500);
  ok('Moves to the photo step once the rate is in', await step()===2);
  ok('Back appears from step 2', await p.locator('#stepBack:visible').count()===1);

  await p.locator('#stepNext').click(); await p.waitForTimeout(400);
  ok('Cannot skip the photo', await step()===2, await toast());

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DwnwEKmBhQAAAA//8DVgn+/hZorNMAAAAASUVORK5CYII=','base64');
  await p.setInputFiles('#selfieInput', {name:'s.png', mimeType:'image/png', buffer:png});
  await p.waitForTimeout(700);
  await p.locator('#stepNext').click(); await p.waitForTimeout(500);
  ok('Moves on once there is a photo', await step()===3);

  await p.locator('#stepNext').click(); await p.waitForTimeout(400);
  ok('Cannot skip the locality', await step()===3, await toast());
  await p.selectOption('#regArea','Jalukbari'); await p.waitForTimeout(200);
  await p.locator('#stepNext').click(); await p.waitForTimeout(500);
  ok('Reaches the last step', await step()===4);
  ok('Publish button appears only here', await p.locator('#regSaveBtn:visible').count()===1);
  ok('Next button is gone on the last step', await p.locator('#stepNext:visible').count()===0);

  // going back must not lose anything
  await p.locator('#stepBack').click(); await p.waitForTimeout(400);
  await p.locator('#stepBack').click(); await p.waitForTimeout(400);
  await p.locator('#stepBack').click(); await p.waitForTimeout(400);
  ok('Back returns to step 1', await step()===1);
  ok('…with the work still chosen', await p.locator('.picked-card').count()===1);
  ok('…and the rate still there', await p.locator('.picked-card .sd-price').first().inputValue()==='400');

  ok('No JS errors', errs.length===0, errs.join(' | ')||'none');
  await b.close(); srv.close();
})();
