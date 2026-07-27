const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT='/home/user/salinur/docs';
const D='/tmp/claude-0/-home-user-salinur/5804f10d-9047-5141-886a-31b320556fa3/scratchpad/';
const T={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css','.txt':'text/plain','.xml':'application/xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('not found');return;}
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8796);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  const errors=[];
  for (const [name, url] of [['About','/about/'],['Privacy','/privacy/'],['Terms','/terms/'],['Cancellation','/cancellation/'],['Delete-account','/delete-account/']]) {
    const p=await ctx.newPage();
    p.on('pageerror',e=>errors.push(name+': '+e.message));
    const res = await p.goto('http://localhost:8796'+url);
    console.log(name, '→ HTTP', res.status(), '|', await p.title());
    console.log('   stylesheet applied:', await p.evaluate(()=>getComputedStyle(document.body).backgroundColor));
    console.log('   logo loads:', await p.evaluate(()=>{const i=document.querySelector('.brand img');return i.complete&&i.naturalWidth>0;}));
    // every internal link must resolve
    const links = await p.$$eval('a[href]', as => as.map(a=>a.href).filter(h=>h.startsWith('http://localhost')));
    const bad=[];
    for (const l of [...new Set(links)]) {
      const r = await fetch(l.split('#')[0]);
      if (!r.ok) bad.push(l+' → '+r.status);
    }
    console.log('   broken internal links:', bad.length ? bad : 'none');
    console.log('   no horizontal overflow:', await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await p.screenshot({path:D+'pg-'+name.toLowerCase()+'.png'});
    await p.close();
  }
  // the experimental-launch notice must actually be on the About page
  const a=await ctx.newPage(); await a.goto('http://localhost:8796/about/');
  const txt=await a.innerText('body');
  console.log('About says experimental launch:', /experimental launch/i.test(txt));
  console.log('About names a grievance officer:', /grievance officer/i.test(txt));
  await a.close();
  // footer of the app must link out to all three
  const app=await ctx.newPage(); await app.goto('http://localhost:8796/'); await app.waitForTimeout(1000);
  console.log('App footer links:', await app.$$eval('.foot-links a', as=>as.map(x=>x.getAttribute('href')).join(', ')));
  console.log('App shows experimental note:', (await app.innerText('footer')).includes('Experimental launch'));
  console.log('JS errors:', errors.length?errors:'none');
  await b.close(); srv.close();
})();
