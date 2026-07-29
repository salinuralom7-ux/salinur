const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');
const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(html);}).listen(8821);
const D = '/tmp/claude-0/-home-user-salinur/5804f10d-9047-5141-886a-31b320556fa3/scratchpad/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8821/'); await p.waitForTimeout(900);
  const code = await p.evaluate(async () => {
    const w = demoAll().find(x => x.name === 'Bhaskar Bora') || demoAll()[0];
    const s = w.skills[0];
    const r = await api.startThread({ workerId:w.id, skill:s.skill, name:'Priya Das', phone:'9876543210',
      area:'Six Mile', detail:'Tomorrow · Morning', note:'Two ceiling fans to fit, and one switchboard is loose.',
      price:s.price, unit:s.unit, mode:'now' });
    rememberBooking({code:r.code, token:r.token, worker:w.name, skill:s.skill, at:new Date().toISOString()});
    await api.workerSetThread(w.phone, w.pin, r.code, 'accepted');
    await api.workerPostMessage(w.phone, w.pin, r.code, 'I can come at 9 in the morning. Is that alright?');
    await api.postMessage(r.code, r.token, 'Yes, 9 is perfect. The gate will be open.');
    await api.workerPostMessage(w.phone, w.pin, r.code, 'Good. I will bring the fan brackets with me.');
    await openChat(r.code, 'customer', 'mine');
    return r.code;
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: D + 'chat-customer.png' });

  // the worker's inbox
  await p.evaluate(() => {
    const w = demoAll().find(x => x.name === 'Bhaskar Bora') || demoAll()[0];
    session = { phone:w.phone, pin:w.pin, name:w.name, registered:true, worker:w };
    saveSession(); go('inbox');
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: D + 'inbox-worker.png' });
  await b.close(); srv.close();
})();
