const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');
const html = fs.readFileSync('/home/user/salinur/docs/index.html','utf8');
const srv = http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(html);}).listen(8840);
const ok=(l,c,x)=>console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:390,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8840/'); await p.waitForTimeout(900);

  // drop straight into the profile form with one skill picked
  await p.evaluate(() => {
    session = {phone:'9435012345', pin:'1234', name:'Test', registered:false};
    go('register'); picked = ['Carpenter']; renderPicked();
  });
  await p.waitForTimeout(600);
  const card = p.locator('.picked-card', { hasText: 'Carpenter' });

  // no market data in preview mode → falls back to the band's top third (>1807)
  await card.locator('.sd-price').fill('800');
  await p.waitForTimeout(250);
  ok('Sensible price gets no nudge', await card.locator('.price-tip:visible').count() === 0);

  await card.locator('.sd-price').fill('2400');
  await p.waitForTimeout(250);
  const tip = (await card.locator('.price-tip').innerText()).replace(/\s+/g,' ').trim();
  ok('High price is nudged', await card.locator('.price-tip:visible').count() === 1, tip);
  ok('Nudge says the thing that matters', /lower your price, the more bookings/i.test(tip));

  await card.locator('.sd-price').fill('9999');
  await p.waitForTimeout(250);
  ok('Out of band still shows the hard limit, not the nudge',
     (await card.locator('.band').innerText()).includes('Too high')
     && await card.locator('.price-tip:visible').count() === 0);

  // the confirmation before publishing
  await card.locator('.sd-price').fill('2400');
  await p.waitForTimeout(250);
  /* The question is a sheet the app draws, not window.confirm(). A native
     confirm can be switched off by the browser, and when it was, Publish
     silently did nothing — see tests/test-publish.js. Any native dialog
     reaching this handler is now itself a failure. */
  const native = [];
  p.on('dialog', async d => { native.push(d.message()); await d.dismiss(); });
  await p.evaluate(() => { window.__saved = false; });
  p.evaluate(() => saveProfile());              /* resolves on an answer, so not awaited */
  await p.waitForTimeout(800);
  const asked = await p.evaluate(() => ({
    open: document.getElementById('askOverlay').classList.contains('open'),
    body: (document.getElementById('askBody') || {}).textContent || '',
  }));
  ok('Publishing at a high price asks first', asked.open);
  ok('…in the app, not through a dialog the browser can suppress', native.length === 0,
     native.join(' | ') || 'none');
  if (asked.open) console.log('       asked: ' + asked.body.split('\n').filter(Boolean).slice(0,2).join(' | '));
  await p.evaluate(() => document.getElementById('askNo').click());
  await p.waitForTimeout(500);
  ok('Choosing to change it keeps them on the form', await p.locator('#scr-register.on').count() === 1);
  ok('…and says nothing was published', /Nothing published/.test(
     await p.evaluate(() => (document.querySelector('.toast.show') || {}).textContent || '')));

  ok('No JS errors', errs.length===0, errs.join(' | ')||'none');
  await b.close(); srv.close();
})();
