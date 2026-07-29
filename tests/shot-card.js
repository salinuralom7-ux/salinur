const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css'};
const srv = http.createServer((q,r)=>{
  let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, u);
  if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; }
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'}); r.end(fs.readFileSync(f));
}).listen(8824);
const D = '/tmp/claude-0/-home-user-salinur/5804f10d-9047-5141-886a-31b320556fa3/scratchpad/';
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, reducedMotion:'reduce' });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8824/'); await p.waitForTimeout(900);
  const code = await p.evaluate(() => {
    const w = demoAll().find(x => x.name === 'Bhaskar Bora') || demoAll()[0];
    session = { phone:w.phone, pin:w.pin, name:w.name, registered:true, worker:w };
    saveSession(); go('card'); return w.worker_code;
  });
  await p.waitForTimeout(1100);
  await p.locator('.idcard').screenshot({ path: D + 'idcard.png' });
  await p.screenshot({ path: D + 'card-screen.png' });
  await p.evaluate(c => { go('verify'); document.getElementById('verifyInput').value = c; return runVerify(c); }, code);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: D + 'verify.png' });
  await b.close(); srv.close();
})();
