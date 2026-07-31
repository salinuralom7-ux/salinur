/* The subscribe half of push, end to end in a real browser: permission,
   subscription, what gets sent to the server, and what the worker is told
   in each of the states they can be in. The sending half is the Edge
   Function and is covered by the SQL tests plus a live check after deploy. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT='/home/user/salinur/docs';
const T={'.html':'text/html','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.js':'application/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const f=path.join(ROOT,p); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8835);
const ok=(l,c,x)=>console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));

  // stand in for the browser's push service, and record what the app saves
  await ctx.addInitScript(() => {
    window.__saved = null;
    window.__perm = 'default';
    Object.defineProperty(Notification, 'permission', { get: () => window.__perm, configurable: true });
    Notification.requestPermission = async () => (window.__perm = 'granted');
    const fakeSub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/TEST-ENDPOINT',
      toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/TEST-ENDPOINT',
                       keys: { p256dh: 'PUB-KEY', auth: 'AUTH-KEY' } })
    };
    navigator.__fakePush = fakeSub;
  });

  await p.goto('http://localhost:8835/'); await p.waitForTimeout(1600);

  // the service worker must be able to receive a push at all
  const swSrc = fs.readFileSync(ROOT+'/sw.js','utf8');
  ok('Service worker handles "push"', /addEventListener\("push"/.test(swSrc));
  ok('Service worker handles "notificationclick"', /addEventListener\("notificationclick"/.test(swSrc));
  ok('Tapping the notification opens the right screen', /notification\.data[\s\S]{0,80}url/.test(swSrc));

  // pretend to be an approved worker looking at their profile
  await p.evaluate(() => {
    session = { phone:'9435019001', pin:'1234', name:'Push Tester', registered:true,
                worker:{ id:'w1', name:'Push Tester', status:'approved', verified:true,
                         available:true, skills:[{skill:'Carpenter',price:900,unit:'per day'}] } };
    go('me');
  });
  await p.waitForTimeout(700);
  ok('Alerts row is on the worker profile', await p.locator('.alert-row').count() === 1);
  ok('It explains what turning them on gets you',
     (await p.locator('.alert-row .push-state').innerText()).length > 20,
     (await p.locator('.alert-row .push-state').innerText()));
  ok('And offers a button', await p.locator('.alert-row .push-optin:visible').count() === 1);

  // granting permission must produce a subscription and save it
  await p.evaluate(() => {
    VAPID_PUBLIC = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkWpjkkFtkbwQdcYSczcm3D3zGRTLxwLM6JUZ8gCUZ5cLp1YAAAAAAA';
    // `ready` is a native getter, so it has to be redefined rather than assigned
    Object.defineProperty(navigator.serviceWorker, 'ready', {
      configurable: true,
      get: () => Promise.resolve({
        pushManager: {
          getSubscription: async () => null,
          subscribe: async (opts) => { window.__subOpts = opts; return navigator.__fakePush; }
        }
      })
    });
    window.__savedCall = null;
    api.savePush = async (phone, pin, sub) => { window.__savedCall = { phone, pin, sub }; };
  });
  await p.locator('.alert-row .push-optin').click();
  await p.waitForTimeout(700);

  const toastText = await p.locator('#toast').innerText().catch(()=> '');
  const call = await p.evaluate(() => window.__savedCall);
  if (!call) console.log('   (diagnostic) toast said:', JSON.stringify(toastText));
  ok('Subscribing sends the endpoint to the server', !!(call && call.sub && call.sub.endpoint),
     call && call.sub && call.sub.endpoint);
  ok('…with both keys the push service needs',
     !!(call && call.sub.p256dh === 'PUB-KEY' && call.sub.auth === 'AUTH-KEY'));
  ok('…authenticated as that worker', !!(call && call.phone === '9435019001'));
  ok('Subscription is userVisibleOnly (browsers reject anything else)',
     await p.evaluate(() => window.__subOpts && window.__subOpts.userVisibleOnly === true));
  ok('Once on, the button goes away',
     await p.locator('.alert-row .push-optin:visible').count() === 0);
  ok('…and it says so', (await p.locator('.alert-row .push-state').innerText()).toLowerCase().includes('on for this phone'));

  // blocked
  await p.evaluate(() => { window.__perm = 'denied'; renderPushState(); });
  await p.waitForTimeout(200);
  ok('Blocked alerts explain where to unblock',
     (await p.locator('.alert-row .push-state').innerText()).toLowerCase().includes('settings'));

  ok('No JS errors', errs.length===0, errs.join(' | ')||'none');
  await b.close(); srv.close();
})();
