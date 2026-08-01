/* The gap that broke every attempt tonight: permission granted, but nothing
   ever registered with the server. Push cannot be exercised headlessly, so
   the browser plumbing is stubbed and the question asked is the one that
   matters — does the app get as far as telling the server, without a second
   tap from the user. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');
const html = fs.readFileSync('/home/user/salinur/docs/index.html','utf8');
const srv = http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(html);}).listen(8850);
const ok=(l,c,x)=>console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));

(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx = await b.newContext({viewport:{width:390,height:844}, permissions:['notifications']});
  await ctx.addInitScript(() => {
    const fake = { endpoint:'https://push.example/abc123', keys:{p256dh:'PKEY', auth:'AKEY'} };
    Object.defineProperty(navigator, 'serviceWorker', { configurable:true, get: () => ({
      ready: Promise.resolve({ pushManager: {
        getSubscription: async () => null,
        subscribe: async () => ({ toJSON: () => fake, endpoint: fake.endpoint })
      }}),
      register: async () => ({}), addEventListener(){}
    })});
  });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8850/'); await p.waitForTimeout(1800);

  // stand in for the server, and give the client the key it would have loaded
  await p.evaluate(() => {
    window.__saved = { worker: [], customer: [] };
    VAPID_PUBLIC = 'BNonzURiE7wn91hkQYJg5Y0oedjlLCg-UjBcZ8NzzIq7SgLLezev4P7sWUjTJvPnMFVNp5IEZE54gdxjggYc_Qc';
    api.savePush = async (phone, pin, sub) => { window.__saved.worker.push(sub); };
    api.saveCustomerPush = async (c, t, sub) => { window.__saved.customer.push(sub); };
  });

  ok('Permission granted in this run', await p.evaluate(()=>Notification.permission) === 'granted');

  // a first-time visitor: permission allowed, no bookings anywhere
  const madeSub = await p.evaluate(async () => {
    try{ const k = await customerSubscription(); return !!(k && k.endpoint); }catch(e){ return 'ERR: '+e.message; }
  });
  ok('A visitor with no bookings still gets a browser subscription', madeSub === true, String(madeSub));

  await p.evaluate(async () => { await syncCustomerPush(); });
  ok('…and nothing is sent to the server, correctly — there is no booking to attach it to',
     await p.evaluate(() => window.__saved.customer.length) === 0);

  // they now sign in as a worker. No second tap anywhere.
  await p.evaluate(async () => {
    session = {phone:'9435012345', pin:'1234', name:'Test', registered:true, worker:{name:'Test'}};
    await syncWorkerPush();
  });
  const w = await p.evaluate(() => window.__saved.worker);
  ok('Signing in registers the device with the server, unprompted', w.length > 0, w.length + ' call(s)');
  if(w.length) ok('…carrying the endpoint and both keys',
                  !!w[0].endpoint && !!w[0].p256dh && !!w[0].auth, w[0].endpoint);

  // and a booking registers the customer side
  await p.evaluate(async () => {
    rememberBooking({ code:'TESTAA', token:'11111111-2222-3333-4444-555555555555',
                      worker:'Someone', skill:'Carpenter', at:new Date().toISOString() });
    await syncCustomerPush();
  });
  ok('Making a booking registers the customer side too',
     await p.evaluate(() => window.__saved.customer.length) > 0);

  ok('No JS errors', errs.length===0, errs.join(' | ')||'none');
  await b.close(); srv.close();
})();
