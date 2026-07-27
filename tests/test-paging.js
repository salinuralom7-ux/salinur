const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');
const html = fs.readFileSync('/home/user/salinur/docs/index.html','utf8');
const srv = http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(html);}).listen(8802);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:390,height:844},
    geolocation:{latitude:26.1445,longitude:91.7362}, permissions:['geolocation']});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8802/'); await p.waitForTimeout(600);

  // seed 137 approved workers into the preview store
  await p.evaluate(() => {
    const areas = ['Six Mile','Jalukbari','Beltola','Dispur','Maligaon'];
    const all = [];
    for (let i = 1; i <= 137; i++) {
      all.push({ id:'p'+i, created_at:new Date().toISOString(), name:'Worker '+i,
        phone:'94350'+String(10000+i), pin:'0000', city:'Guwahati', area:areas[i%5],
        selfie:null, lat:26.1445+((i%40)-20)*0.004, lng:91.7362+((i%31)-15)*0.004,
        skills:[ i%3===0 ? {skill:'Electrician',price:400,unit:'per visit'}
                         : {skill:'Plumber',price:350,unit:'per visit'} ],
        available:true, status:'approved', verified:true, phone_verified:true,
        rating_sum:(i%5)*5, rating_count:i%5===0?0:5 });
    }
    localStorage.setItem('nearse_workers_v1', JSON.stringify(all));
  });
  await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => go('hire')); await p.waitForTimeout(1200);

  const cards = () => p.locator('.wcard').count();
  console.log('First page size (expect 20):', await cards());
  console.log('Meta reports the real total:', (await p.locator('#resultMeta').innerText()).replace(/\n/g,' / '));
  console.log('Load-more offers the remainder:', (await p.locator('#moreBtn').innerText()).replace(/\n/g,' '));

  await p.locator('#moreBtn').click(); await p.waitForTimeout(600);
  console.log('After one Load more (expect 40):', await cards());
  await p.locator('#moreBtn').click(); await p.waitForTimeout(600);
  console.log('After two (expect 60):', await cards());

  const ids = await p.$$eval('.wcard', els => els.map(e => e.getAttribute('onclick')));
  console.log('No duplicate cards across pages:', new Set(ids).size === ids.length);

  const km = await p.$$eval('.wcard .where em', els => els.slice(0,6).map(e => e.textContent.trim()));
  console.log('Still nearest-first after paging:', km.join(' | '));

  // a new search must reset to page one
  await p.fill('#hireSearch','electrician'); await p.waitForTimeout(700);
  console.log('Search resets to one page:', await cards());
  console.log('Search total:', (await p.locator('#resultMeta').innerText()).split('\n')[0]);
  await p.selectOption('#areaFilter','Jalukbari'); await p.waitForTimeout(700);
  console.log('Locality + search combined:', (await p.locator('#resultMeta').innerText()).split('\n')[0]);
  await p.locator('#clearSearch').click(); await p.waitForTimeout(700);
  await p.selectOption('#areaFilter',''); await p.waitForTimeout(700);
  console.log('Back to everything:', await cards(), '|', (await p.locator('#resultMeta').innerText()).split('\n')[0]);

  // rapid typing must not let a stale reply win
  for (const t of ['e','el','ele','elec','electrician']) { await p.fill('#hireSearch', t); }
  await p.waitForTimeout(1200);
  console.log('Rapid typing settles correctly:', (await p.locator('#resultMeta').innerText()).split('\n')[0]);
  console.log('JS errors:', errs.length?errs:'none');
  await b.close(); srv.close();
})();
