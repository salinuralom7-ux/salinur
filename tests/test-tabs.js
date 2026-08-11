const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT='/home/user/salinur/docs';
const T={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8840);
const ok=(l,c,x)=>{console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));if(!c)process.exitCode=1;};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://localhost:8840/');
  /* boot now also asks the database for banners, so the bar is painted a
     little later than it used to be. 1200ms caught it about one run in ten. */
  await page.waitForTimeout(2000);

  ok('The bar is there', await page.locator('#tabbar').isVisible());
  ok('Five slots', await page.locator('#tabbar > button').count() === 5);
  ok('Home is lit on open', await page.locator('#tabHome.on').count() === 1);
  ok('The raised button offers to register a skill',
     (await page.locator('#tabFabLabel').innerText()).replace(/\s+/g,' ').trim() === 'Register your skill');

  await page.locator('#tabBrowse').click(); await page.waitForTimeout(700);
  ok('Browse goes to the results screen', await page.locator('#scr-hire.on').count() === 1);
  ok('…and lights Browse', await page.locator('#tabBrowse.on').count() === 1);
  ok('…and unlights Home', await page.locator('#tabHome.on').count() === 0);

  await page.locator('#tabFab').click(); await page.waitForTimeout(700);
  ok('The raised button opens the sign-up', await page.locator('#scr-work.on').count() === 1);
  ok('…and stays lit there', await page.locator('#tabFab.on').count() === 1);

  await page.locator('#tabBookings').click(); await page.waitForTimeout(700);
  ok('Bookings opens the list', await page.locator('#scr-chats.on').count() === 1);

  await page.locator('#tabHome').click(); await page.waitForTimeout(700);
  ok('Home comes back', await page.locator('#scr-home.on').count() === 1);

  await page.locator('#tabMore').click(); await page.waitForTimeout(600);
  ok('More opens the menu', await page.locator('#drawer.open').count() === 1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);

  /* The bar is a row of the shell, not something floating over the page, so
     "leaving room for it" is no longer a padding the page has to remember to
     carry — it is a consequence of the layout. Assert the layout instead:
     one viewport-tall body that does not scroll, a middle that does, and a
     bar whose bottom edge is the bottom of the screen. */
  const clear = await page.evaluate(() => {
    const bar = document.getElementById('tabbar').getBoundingClientRect();
    const sc = document.getElementById('scroll');
    return { barH: Math.round(bar.height), barBottom: Math.round(bar.bottom),
             win: window.innerHeight,
             docScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
             middleScrolls: sc.scrollHeight > sc.clientHeight + 1,
             position: getComputedStyle(document.getElementById('tabbar')).position };
  });
  ok('The bar sits in normal flow, not over the page', clear.position === 'relative', clear.position);
  ok('The document itself does not scroll', clear.docScrolls === false);
  ok('The middle is what scrolls', clear.middleScrolls);
  ok('Every screen leaves room for it', Math.abs(clear.barBottom - clear.win) <= 1,
     `bar ${clear.barH}px ending at ${clear.barBottom} of ${clear.win}`);

  /* The reported bug: scrolled to the very bottom, the bar sat on top of the
     footer's social buttons. The page has to end above the bar, not behind it. */
  await page.evaluate(() => { const s = document.getElementById('scroll'); s.scrollTop = s.scrollHeight; });
  await page.waitForTimeout(500);
  const foot = await page.evaluate(() => {
    const bar = document.getElementById('tabbar').getBoundingClientRect();
    const links = [...document.querySelectorAll('footer a')];
    const hidden = links.filter(a => {
      const r = a.getBoundingClientRect();
      return r.height > 0 && r.bottom > bar.top + 1 && r.top < bar.bottom;
    });
    return { n: links.length, hidden: hidden.map(a => a.textContent.trim().slice(0, 14)) };
  });
  ok('At the very bottom the footer is not under the bar',
     foot.hidden.length === 0, foot.hidden.join(', ') || `all ${foot.n} clear`);
  await page.evaluate(() => { document.getElementById('scroll').scrollTop = 0; });
  await page.waitForTimeout(300);

  // the conversation is a full surface
  await page.evaluate(() => document.body.classList.add('in-chat'));
  ok('It gets out of the way in a conversation',
     await page.locator('#tabbar').isVisible() === false);
  await page.evaluate(() => document.body.classList.remove('in-chat'));

  ok('No horizontal overflow',
     await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok('No JS errors', errs.length === 0, errs.join(' | ') || 'none');
  await b.close(); srv.close();
})();
