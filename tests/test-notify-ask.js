const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');
const html = fs.readFileSync('/home/user/salinur/docs/index.html','utf8');
const srv = http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(html);}).listen(8842);
const ok=(l,c,x)=>console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});

  // ---- permission not yet answered: the sheet should appear ----
  let ctx = await b.newContext({viewport:{width:390,height:844}});
  let p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8842/'); await p.waitForTimeout(3400);
  ok('Prompt appears on first open', await p.locator('#notifyOverlay.open').count() === 1);
  const t = (await p.locator('#notifyAskTitle').innerText()).trim();
  ok('Exact wording', t === 'Turn the notification on for better experience', t);
  const btns = await p.locator('#notifyOverlay .btn').allTextContents();
  ok('Allow and Don\'t allow offered', btns.join(' | ').includes('Allow') && btns.join(' | ').includes("Don't allow"), btns.join(' | '));

  await p.locator('#notifyOverlay .btn-quiet').click();
  await p.waitForTimeout(400);
  ok('Don\'t allow closes it', await p.locator('#notifyOverlay.open').count() === 0);
  ok('…without burning the browser permission',
     await p.evaluate(() => Notification.permission) === 'default');

  // ---- it comes back next time, as asked ----
  await p.reload(); await p.waitForTimeout(3400);
  ok('It asks again on the next open', await p.locator('#notifyOverlay.open').count() === 1);
  await p.close(); await ctx.close();

  // ---- already granted: never ask ----
  ctx = await b.newContext({viewport:{width:390,height:844}, permissions:['notifications']});
  p = await ctx.newPage();
  await p.goto('http://localhost:8842/'); await p.waitForTimeout(3400);
  ok('Never asks once already allowed', await p.locator('#notifyOverlay.open').count() === 0,
     await p.evaluate(() => Notification.permission));
  await p.close(); await ctx.close();

  // ---- the footer heading ----
  ctx = await b.newContext({viewport:{width:390,height:844}});
  p = await ctx.newPage();
  await p.goto('http://localhost:8842/'); await p.waitForTimeout(1200);
  const lead = p.locator('.foot-lead').first();
  ok('Footer heading present', await lead.count() > 0, (await lead.innerText()).trim());
  const box = await lead.boundingBox();
  const reach = await p.locator('.foot-reach').first().boundingBox();
  ok('Sits directly above the contact row', box.y + box.height <= reach.y + 2);
  ok('Centred', Math.abs((box.x + box.width/2) - 195) < 3, Math.round(box.x + box.width/2) + 'px of 195');
  ok('Brand colour', (await lead.evaluate(e => getComputedStyle(e).color)) === 'rgb(243, 208, 124)',
     await lead.evaluate(e => getComputedStyle(e).color));
  await p.locator('footer').screenshot({path:'footer.png'});

  ok('No JS errors', errs.length===0, errs.join(' | ')||'none');
  await b.close(); srv.close();
})();
