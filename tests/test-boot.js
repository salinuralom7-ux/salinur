/* How fast the app becomes useful.

   The complaint was that the page "takes time to load, a few things appear
   immediately and a few take time". It did, and the reason was structural
   rather than mysterious: start-up was one chain of awaits, and the home
   screen was drawn at the end of it. Four round trips to the database ran
   strictly one after another before a single tile appeared.

   Every request here is answered by this test rather than by Supabase, after
   a fixed delay, so the numbers are about the shape of the boot and not about
   whoever's wifi is running the suite. RTT is what an ordinary 4G phone in
   Guwahati sees; the assertions are in units of it, so they mean "one round
   trip deep" rather than a millisecond count that would rot. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css',
           '.woff2':'font/woff2','.webp':'image/webp'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8844);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };
const RTT = 400;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));

  const calls = [];
  let t0 = Date.now();
  await ctx.route('**://*.supabase.co/**', async route => {
    const url = route.request().url().split('/rest/v1/')[1] || route.request().url();
    calls.push({ url, sentAt: Date.now() - t0 });
    await new Promise(r => setTimeout(r, RTT));
    let body = '[]';
    if (url.startsWith('nearse_config')) body = JSON.stringify([{ require_phone_otp:false, vapid_public:null, push_url:null }]);
    if (url.startsWith('workers?select=id')) body = JSON.stringify([{ id:'x' }]);
    if (url.includes('home_banners')) body = JSON.stringify([
      { slot:1, image_url:'banners/register-your-skill.webp', link_url:null, alt:'Register your skill' }]);
    route.fulfill({ status:200, contentType:'application/json', body });
  });

  t0 = Date.now();
  await page.goto('http://localhost:8844/');

  const want = {
    'the service tiles': () => document.querySelectorAll('#quickGrid .qtile').length >= 12,
    'the two counts':    () => /^\d+$/.test((document.getElementById('figServices')||{}).textContent || ''),
    'the tab bar':       () => document.querySelectorAll('#tabbar .tab.on, #tabbar .tab-fab.on').length > 0,
    'the ad banner':     () => { const e = document.getElementById('adBand'); return !!e && !e.hidden; },
  };
  const marks = {}; const keys = Object.keys(want);
  while (Object.keys(marks).length < keys.length && Date.now() - t0 < 15000) {
    for (const k of keys) {
      if (marks[k] !== undefined) continue;
      let v = false; try { v = await page.evaluate(want[k]); } catch (e) {}
      if (v) marks[k] = Date.now() - t0;
    }
    await page.waitForTimeout(20);
  }

  /* Everything drawn from constants already in the page must not be waiting
     on the network at all — under one round trip, comfortably. */
  for (const k of ['the service tiles', 'the two counts', 'the tab bar'])
    ok(`${k} appear without waiting for the database`, marks[k] !== undefined && marks[k] < RTT,
       marks[k] === undefined ? 'never' : marks[k] + 'ms (one round trip is ' + RTT + 'ms)');

  /* The banner does need the database — but one round trip's worth, not
     three. It used to be sent third in a chain and landed at 1294ms. */
  ok('the ad banner is one round trip deep, not three',
     marks['the ad banner'] !== undefined && marks['the ad banner'] < RTT * 2,
     marks['the ad banner'] === undefined ? 'never' : marks['the ad banner'] + 'ms');

  /* The structural claim, and the one that will catch a regression first:
     the opening requests leave together. */
  const opening = calls.filter(c => c.sentAt < RTT);
  const spread = opening.length > 1
    ? Math.max(...opening.map(c => c.sentAt)) - Math.min(...opening.map(c => c.sentAt)) : 0;
  console.log('      requests: ' + calls.map(c => `+${c.sentAt}ms ${c.url.slice(0, 34)}`).join('\n                ') );
  ok('the opening requests go out together, not one after another',
     opening.length >= 3 && spread < 60, `${opening.length} in flight, ${spread}ms apart`);
  ok('nothing is sent a full round trip after the first',
     !calls.some(c => c.sentAt > RTT * 0.9 && c.sentAt < RTT * 2.5),
     calls.map(c => '+' + c.sentAt).join(' '));

  /* The tiles that are on screen at open must not be lazy — marking an
     in-view image lazy only means "fetch it later", and the grid filled in
     one tile at a time after the layout had settled. */
  /* Indexed by tile, not by surviving image: a trade with no photograph yet
     404s and removes its own <img>, so the list of images is shorter than the
     list of tiles and the two do not line up. */
  const imgs = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#quickGrid .qtile')];
    return tiles.map((t, i) => { const im = t.querySelector('img'); return im ? [i, im.loading] : null; })
                .filter(Boolean);
  });
  const above = imgs.filter(([i]) => i < 8), below = imgs.filter(([i]) => i >= 8);
  ok('the tiles above the fold are fetched eagerly',
     above.length > 0 && above.every(([, l]) => l === 'eager'),
     above.map(([i, l]) => i + ':' + l).join(' '));
  ok('the row below the fold is still lazy',
     below.every(([, l]) => l === 'lazy'), below.map(([i, l]) => i + ':' + l).join(' ') || 'none');
  const banner = await page.evaluate(() => {
    const i = document.querySelector('#adBandTrack img'); return i ? i.loading : 'absent'; });
  ok('the visible banner slide is fetched eagerly', banner === 'eager', banner);

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
