const { chromium } = require('playwright');
const http = require('http');
require('fs').mkdirSync('tests/shots', { recursive: true }); const fs = require('fs');
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
  // read the variable rather than a literal, so a palette change is not a failure
  ok('Brand colour', await lead.evaluate(e => {
        const want = getComputedStyle(document.documentElement).getPropertyValue('--brand-2').trim();
        const hex = n => '#' + n.match(/\d+/g).map(v => (+v).toString(16).padStart(2,'0')).join('');
        return hex(getComputedStyle(e).color).toLowerCase() === want.toLowerCase();
     }), await lead.evaluate(e => getComputedStyle(e).color));
  await p.locator('footer').screenshot({path:'tests/shots/footer.png'});

  // ---- the browser that never shows the prompt ----
  /* Chrome answers requestPermission() with "default" — no dialog, just a
     quiet chip — for anyone who has dismissed prompts before. Permission never
     becomes granted, so the sheet used to return on every single launch,
     asking a browser that had already decided not to ask. It read as the app
     forgetting a permission that was never actually given. */
  const askedWith = async (setup) => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await c.newPage();
    await pg.addInitScript(setup);
    await pg.goto('http://localhost:8842/');
    /* The 2200ms timer starts after boot's opening requests settle, not at
       page load, so a fixed 2600ms sleep raced them: when Supabase was slow
       to refuse the connection the sheet opened just after the check and
       "comes back a week later" failed about one run in three. Wait for the
       sheet instead, and only give up after long enough that not-appearing
       is a real answer. */
    let shown = false;
    try { await pg.waitForSelector('#notifyOverlay.open', { timeout: 7000 }); shown = true; }
    catch (e) { shown = false; }
    await pg.close(); await c.close();
    return shown;
  };
  const DAY = 24 * 3600 * 1000;

  ok('Never asked before: the sheet appears',
     await askedWith(() => localStorage.removeItem('repto_notify_tried_v1')) === true);

  ok('Asked, and the browser left us on "default": it backs off',
     await askedWith(() =>
       localStorage.setItem('repto_notify_tried_v1', String(Date.now()))) === false);

  ok('…and comes back a week later, rather than never',
     await askedWith(() =>
       localStorage.setItem('repto_notify_tried_v1', String(Date.now() - 8 * 86400000))) === true);

  ok('Six days later it is still quiet',
     await askedWith(() =>
       localStorage.setItem('repto_notify_tried_v1', String(Date.now() - 6 * 86400000))) === false);

  // granting clears the back-off, so a later revoke asks again immediately
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['notifications'] });
    const pg = await c.newPage();
    await pg.addInitScript(() => localStorage.setItem('repto_notify_tried_v1', String(Date.now())));
    await pg.goto('http://localhost:8842/'); await pg.waitForTimeout(900);
    const r = await pg.evaluate(async () => {
      const perm = await askBrowserForNotifications();
      return { perm, leftover: localStorage.getItem('repto_notify_tried_v1') };
    });
    ok('Granting clears the back-off', r.perm === 'granted' && r.leftover === null,
       `${r.perm}, leftover=${r.leftover}`);
    await pg.close(); await c.close();
  }

  ok('No JS errors', errs.length===0, errs.join(' | ')||'none');
  await b.close(); srv.close();
})();
