/* The chat bubble, after a bare `.tick` rule meant for the landing-page ticker
   turned the read receipt into a rounded grey pill sitting on the timestamp. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css','.woff2':'font/woff2'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8826);

const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8826/'); await page.waitForTimeout(1300);

  const code = await page.evaluate(() => {
    const w = demoAll()[0];
    const t = demoStartThread({ workerId: w.id, skill: 'Plumber', mode: 'appointment',
      detail: 'Today', name: 'Salinur', phone: '9876543210', area: 'Panbazar',
      price: 1000, unit: 'per visit' });
    rememberBooking({ code: t.code, token: t.token, worker_name: t.worker_name,
                      skill: 'Plumber', created_at: new Date().toISOString() });
    demoSetThread(t.code, 'accepted', 'worker');
    demoPost(t.code, 'worker', 'Hy');
    demoPost(t.code, 'customer', 'Short one');
    demoPost(t.code, 'customer', 'A far longer message, long enough that the text fills the whole bubble and the time cannot share the last line with it.');
    const all = allThreads(); const th = all.find(x => x.code === t.code);
    th.worker_read_id = th.messages.filter(m => m.sender === 'customer')[0].id;
    saveThreads(all);
    return t.code;
  });
  await page.evaluate(c => openChat(c, 'customer', 'chats'), code);
  await page.waitForTimeout(1500);

  // ---------- the receipt is a receipt, not a pill ----------
  const box = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.msg-ticks'));
    const r = document.querySelector('.msg-ticks').getBoundingClientRect();
    return { bg: cs.backgroundColor, border: cs.borderTopWidth, pad: cs.paddingTop,
             radius: cs.borderTopLeftRadius, w: Math.round(r.width), h: Math.round(r.height) };
  });
  ok('No background behind the ticks', box.bg === 'rgba(0, 0, 0, 0)', box.bg);
  ok('No border around them', box.border === '0px', box.border);
  ok('No padding inflating them', box.pad === '0px', box.pad);
  ok('Small, the size of a receipt', box.w <= 20 && box.h <= 14, box.w + '×' + box.h);
  ok('The old .tick class is gone from the chat',
     await page.locator('#chatLog .tick').count() === 0);
  ok('…and the ticker rule that caused it is scoped',
     /\.ticker \.tick\{/.test(fs.readFileSync(ROOT + '/index.html', 'utf8')));

  // ---------- one tick sent, two read ----------
  const shown = el => page.evaluate(sel => {
    const m = document.querySelector(sel);
    return [...m.querySelectorAll('.msg-ticks svg')]
      .filter(s => getComputedStyle(s).display !== 'none')
      .map(s => s.getAttribute('class'));
  }, el);
  ok('One tick while only sent', JSON.stringify(await shown('.msg.own:not(.read)')) === '["one"]',
     JSON.stringify(await shown('.msg.own:not(.read)')));
  ok('Two ticks once read', JSON.stringify(await shown('.msg.own.read')) === '["two"]',
     JSON.stringify(await shown('.msg.own.read')));
  ok('Read is also brighter than sent', await page.evaluate(() => {
    const a = getComputedStyle(document.querySelector('.msg.own:not(.read) .msg-meta')).opacity;
    const c = getComputedStyle(document.querySelector('.msg.own.read .msg-meta')).opacity;
    return parseFloat(c) > parseFloat(a);
  }));

  // ---------- the WhatsApp layout ----------
  const inline = sel => page.evaluate(s => {
    const m = document.querySelector(s);
    const txt = m.querySelector('.msg-text').getBoundingClientRect();
    const meta = m.querySelector('.msg-meta').getBoundingClientRect();
    return { same: Math.abs(meta.top - txt.top) < 6, right: Math.round(m.getBoundingClientRect().right - meta.right) };
  }, sel);
  const short = await inline('.msg.own.read');
  ok('A short message keeps the time on its line', short.same);
  const msgs = await page.locator('.msg.own').count();
  const long = await page.evaluate(() => {
    const m = [...document.querySelectorAll('.msg.own')].find(x => x.querySelector('.msg-text').textContent.length > 60);
    const txt = m.querySelector('.msg-text').getBoundingClientRect();
    const meta = m.querySelector('.msg-meta').getBoundingClientRect();
    return { wrapped: meta.top > txt.top + 6, rightAligned: Math.abs(m.getBoundingClientRect().right - meta.right) < 16 };
  });
  ok('A long one drops the time to its own line', long.wrapped);
  ok('…still hard against the right edge', long.rightAligned);
  ok('The meta sits inside the bubble, not under it', await page.evaluate(() => {
    const m = document.querySelector('.msg.own');
    const r = m.getBoundingClientRect(), q = m.querySelector('.msg-meta').getBoundingClientRect();
    return q.bottom <= r.bottom + 1 && q.top >= r.top - 1;
  }));
  ok('Incoming bubbles get a time but no ticks', await page.evaluate(() => {
    const m = document.querySelector('.msg.them');
    return !!m.querySelector('.msg-meta') && !m.querySelector('.msg-ticks');
  }));
  ok('Bubbles no longer taller than they need to be',
     await page.evaluate(() => Math.round(document.querySelector('.msg.own.read').getBoundingClientRect().height)) <= 40,
     await page.evaluate(() => Math.round(document.querySelector('.msg.own.read').getBoundingClientRect().height)) + 'px');

  // ---------- which day ----------
  ok('The day is stated', await page.locator('.msg-day').count() >= 1,
     (await page.locator('.msg-day').allTextContents()).join(', '));
  ok('Said once, not per message', await page.locator('.msg-day').count() === 1);

  // ---------- nothing zooms ----------
  const vp = await page.evaluate(() => document.querySelector('meta[name=viewport]').content);
  ok('Pinch zoom is off', /user-scalable=no/.test(vp) && /maximum-scale=1/.test(vp), vp);
  ok('Every text field is at least 16px, so iOS will not zoom on focus', await page.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('on'));
    document.querySelectorAll('.overlay').forEach(s => s.classList.add('open'));
    return [...document.querySelectorAll('input, textarea, select')].every(el =>
      ['checkbox','radio','file','hidden','range','submit','button'].includes((el.type||'').toLowerCase()) ||
      parseFloat(getComputedStyle(el).fontSize) >= 16);
  }));
  ok('Taps do not wait for a second tap', await page.evaluate(() =>
     getComputedStyle(document.querySelector('button')).touchAction.includes('manipulation')));

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
