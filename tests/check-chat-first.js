/* The conversation belongs in Repto: accepting an instant job opens one, the
   customer is offered it before WhatsApp, and a message shows one tick when it
   has been sent and two once the other side has opened the chat. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8831);
const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];

  const cust = await ctx.newPage();
  cust.on('pageerror', e => errors.push('customer: ' + e.message));
  await cust.goto('http://localhost:8831/');
  await cust.waitForTimeout(900);

  // one electrician, one instant job, accepted
  const ids = await cust.evaluate(async () => {
    const all = demoAll();
    const w = all[0];
    w.skills = [{ skill:'Electrician', price:400, unit:'per visit', exp:'5 years' }];
    w.status = 'approved'; w.verified = true;
    demoSave(all);
    const job = await api.createJob({ skill:'Electrician', name:'Anita', phone:'9876500044',
      area:'Jalukbari', note:'Two fans dead', workerId:w.id, lat:w.lat, lng:w.lng });
    const acc = await api.acceptOffer(w.phone, w.pin, job.code, 30);
    return { phone:w.phone, pin:w.pin, name:w.name, job:job.code, jobToken:job.customer_token,
             thread:acc.thread_code, threadToken:acc.thread_token };
  });
  ok('Accepting opens a conversation', !!ids.thread, ids.thread);
  ok('…and hands the customer a token for it', !!ids.threadToken);

  // the job token, and only the job token, unlocks it for the customer
  const gate = await cust.evaluate(async i => ({
    withToken: (await api.jobState(i.job, i.jobToken) || {}).thread_code || null,
    without:   (await api.jobState(i.job) || {}).thread_code || null,
    wrong:     (await api.jobState(i.job, 'demo-job-wrong') || {}).thread_code || null,
  }), ids);
  ok('The job token opens the conversation', gate.withToken === ids.thread);
  ok('The job code alone does not', gate.without === null, String(gate.without));
  ok('A wrong token does not', gate.wrong === null, String(gate.wrong));

  // ---------- the customer's screen leads inwards ----------
  await cust.evaluate(async i => {
    nowJob = { code:i.job, token:i.jobToken, skill:'Electrician', name:'Anita',
               phone:'9876500044', area:'Jalukbari', note:'Two fans dead' };
    openModal('searchOverlay');
    await pollJob();
  }, ids);
  await cust.waitForTimeout(900);
  ok('Customer is told the worker is coming',
     (await cust.locator('#searchBody').innerText()).includes('is coming'));
  ok('The in-app conversation is the primary action',
     await cust.locator('#jobChatBtn:visible').count() === 1);
  ok('WhatsApp is offered underneath it, not instead',
     await cust.locator('#jobWaBtn:visible').count() === 1);

  await cust.locator('#jobChatBtn').click();
  await cust.waitForTimeout(1200);
  ok('Tapping it opens the chat inside the app',
     await cust.evaluate(() => (document.querySelector('.screen.on') || {}).id) === 'scr-chat');
  ok('…showing the system message from the acceptance',
     (await cust.locator('#chatLog').innerText()).includes('accepted this job'));

  // back must leave the chat, not bounce between sheet and screen
  await cust.goBack();
  await cust.waitForTimeout(700);
  ok('Back leaves the conversation cleanly',
     await cust.evaluate(() => (document.querySelector('.screen.on') || {}).id) !== 'scr-chat');

  // ---------- ticks ----------
  await cust.evaluate(i => openChat(i.thread, 'customer', 'mine'), ids);
  await cust.waitForTimeout(1000);
  await cust.fill('#chatInput', 'Please come to the back gate');
  await cust.locator('#chatSend').click();
  await cust.waitForTimeout(900);
  const own = cust.locator('#chatLog .msg.own').last();
  /* `.tick` was renamed to `.msg-ticks` when the service ticker's own .tick
     was found to be styling the read receipt as well — a 15px pair of ticks
     in a chat bubble. This selector was not renamed with it. */
  ok('The customer\'s message carries a tick', await own.locator('.msg-ticks').count() === 1);
  ok('One tick until the worker opens it', !(await own.getAttribute('class')).includes('read'),
     await own.getAttribute('class'));

  // the worker opens the conversation in their own tab
  const worker = await ctx.newPage();
  worker.on('pageerror', e => errors.push('worker: ' + e.message));
  await worker.goto('http://localhost:8831/');
  await worker.waitForTimeout(800);
  await worker.bringToFront();
  await worker.evaluate(async i => {
    const w = demoAll().find(x => x.phone === i.phone);
    session = { phone:w.phone, pin:w.pin, name:w.name, registered:true, worker:w };
    saveSession();
    await openChat(i.thread, 'worker', 'inbox');
  }, ids);
  await worker.waitForTimeout(1200);
  ok('The worker sees the customer\'s message',
     (await worker.locator('#chatLog').innerText()).includes('back gate'));

  // and the customer's tick turns
  await cust.bringToFront();
  await cust.evaluate(() => refreshChat(false));
  await cust.waitForTimeout(1200);
  ok('Two ticks once the worker has opened it',
     (await cust.locator('#chatLog .msg.own').last().getAttribute('class')).includes('read'),
     await cust.locator('#chatLog .msg.own').last().getAttribute('class'));

  // the other direction
  await worker.bringToFront();
  await worker.fill('#chatInput', 'On my way now');
  await worker.locator('#chatSend').click();
  await worker.waitForTimeout(900);
  const wown = worker.locator('#chatLog .msg.own').last();
  ok('The worker\'s reply starts on one tick',
     !(await wown.getAttribute('class')).includes('read'));
  await cust.bringToFront();
  await cust.evaluate(() => refreshChat(false));
  await cust.waitForTimeout(1000);
  await worker.bringToFront();
  await worker.evaluate(() => refreshChat(false));
  await worker.waitForTimeout(1000);
  ok('…and turns once the customer reads it',
     (await worker.locator('#chatLog .msg.own').last().getAttribute('class')).includes('read'),
     await worker.locator('#chatLog .msg.own').last().getAttribute('class'));

  /* Also .msg-ticks: as `.tick` this passed whatever the markup did, because
     nothing in a chat bubble has carried that class since the rename. */
  ok('Incoming messages carry no tick',
     await worker.locator('#chatLog .msg.them .msg-ticks').count() === 0);

  ok('No JS errors anywhere', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
