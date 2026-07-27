const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');
const html = fs.readFileSync('/home/user/salinur/docs/index.html','utf8');
const srv = http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(html);}).listen(8821);
const ok=(l,c,x)=>console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  for (const w of [375, 390, 768, 1280, 1600]) {
    const p=await b.newPage({viewport:{width:w,height:820}});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8821/'); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const names = document.getAnimations().map(a=>a.animationName);
      const motes = [...document.querySelectorAll('.motes span')];
      return {
        overflow: document.documentElement.scrollWidth <= innerWidth + 1,
        sheen: names.filter(n=>n==='sheen').length,
        halo:  names.filter(n=>n==='halo').length,
        embers:names.filter(n=>n==='ember').length,
        // an ember must actually travel the height of the hero
        travel: Math.round(Math.abs(new DOMMatrix(getComputedStyle(motes[0]).transform).m42)),
        heroH:  Math.round(document.querySelector('.hero').getBoundingClientRect().height),
        emberVisible: motes.some(m => +getComputedStyle(m).opacity > 0.05),
      };
    });
    console.log(String(w).padStart(5)+'px', 'overflow:'+(r.overflow?'no ':'YES'),
      '| sheen '+r.sheen, 'halo '+r.halo, 'embers '+r.embers,
      '| lead ember at '+r.travel+'px of '+r.heroH+' hero', '| any visible:', r.emberVisible,
      '| errors:', errs.length||'none');
    await p.close();
  }
  // reduced motion: everything holds still, nothing disappears
  const ctx=await b.newContext({viewport:{width:390,height:820},reducedMotion:'reduce'});
  const p=await ctx.newPage();
  await p.goto('http://localhost:8821/'); await p.waitForTimeout(900);
  ok('Reduced motion hides the embers', await p.evaluate(()=>getComputedStyle(document.querySelector('.motes')).display)==='none');
  ok('Reduced motion keeps the headline gold', await p.evaluate(()=>{
    const em=document.querySelector('.landing h1 em');
    return getComputedStyle(em).backgroundImage.includes('gradient') && getComputedStyle(em).animationName==='none';
  }));
  ok('Headline still readable', (await p.locator('.landing h1').innerText()).includes('right where you are'));
  await b.close(); srv.close();
})();
