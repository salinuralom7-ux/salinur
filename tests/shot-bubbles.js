/* Renders a conversation that mirrors the reported screenshot — accepted job,
   one message in, two out, one read — so the bubbles can be looked at. */
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
}).listen(8823);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('http://localhost:8823/'); await page.waitForTimeout(1300);

  const code = await page.evaluate(() => {
    const w = demoAll()[0];
    const t = demoStartThread({ workerId: w.id, skill: 'Competitive Exam Coach', mode: 'appointment',
      detail: 'Today · Anytime', name: 'Salinur Alom Pramanik', phone: '9876543210',
      area: 'Panbazar', price: 1000, unit: 'per visit' });
    rememberBooking({ code: t.code, token: t.token, worker_name: t.worker_name,
                      skill: 'Competitive Exam Coach', created_at: new Date().toISOString() });
    demoSetThread(t.code, 'accepted', 'worker');
    demoPost(t.code, 'worker', 'Hy');
    demoPost(t.code, 'customer', 'Hello WhatsApp');
    demoPost(t.code, 'customer', 'This one is a much longer message, long enough that the text fills the bubble and the time has to drop onto its own line underneath.');
    const all = allThreads(); const th = all.find(x => x.code === t.code);
    const firstOut = th.messages.filter(m => m.sender === 'customer')[0];
    th.worker_read_id = firstOut.id;          // read up to the first outgoing one
    saveThreads(all);
    return t.code;
  });

  await page.evaluate(c => openChat(c, 'customer', 'chats'), code);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: __dirname + '/shots/chat-after.png' });

  const m = await page.evaluate(() => {
    const own = [...document.querySelectorAll('.msg.own')];
    const sent = own.find(el => !el.classList.contains('read'));
    const read = own.find(el => el.classList.contains('read'));
    const shown = el => [...el.querySelectorAll('.msg-ticks svg')]
      .filter(s => getComputedStyle(s).display !== 'none')
      .map(s => s.getAttribute('class') + ' ' + Math.round(s.getBoundingClientRect().width) +
                '×' + Math.round(s.getBoundingClientRect().height));
    const cs = getComputedStyle(sent.querySelector('.msg-ticks'));
    const short = own.find(el => el.querySelector('.msg-text').textContent.length < 20);
    const long  = own.find(el => el.querySelector('.msg-text').textContent.length > 60);
    const sameLine = el => Math.abs(el.querySelector('.msg-meta').getBoundingClientRect().top -
                                    el.querySelector('.msg-text').getBoundingClientRect().top) < 6;
    return {
      ticks_background: cs.backgroundColor,
      ticks_border: cs.borderTopWidth,
      ticks_padding: cs.paddingTop,
      when_sent: shown(sent),
      when_read: shown(read),
      short_message_time_inline: sameLine(short),
      long_message_time_wraps: !sameLine(long),
      bubble_height_short: Math.round(short.getBoundingClientRect().height),
      day_dividers: [...document.querySelectorAll('.msg-day')].map(d => d.textContent),
    };
  });
  console.log(JSON.stringify(m, null, 2));
  console.log('viewport:', await page.evaluate(() => document.querySelector('meta[name=viewport]').content));
  await b.close(); srv.close();
})();
