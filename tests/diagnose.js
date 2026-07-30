/* A read-only health check. Measures what a phone actually pays to load, and
   looks for the things that make an app feel unfinished: controls too small to
   hit, text too faint to read, fields with no label. Changes nothing. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css','.woff2':'font/woff2',
           '.txt':'text/plain','.xml':'application/xml'};
let bytes = 0; const reqs = [];
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  const buf = fs.readFileSync(f);
  bytes += buf.length; reqs.push({ p, kb: Math.round(buf.length / 1024) });
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(buf);
}).listen(8828);

const H = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 56 - t.length)));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
    geolocation: { latitude: 26.1445, longitude: 91.7362 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errs = [], warns = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') warns.push(m.text().slice(0, 90)); });
  await page.goto('http://localhost:8828/', { waitUntil: 'load' });
  await page.waitForTimeout(1600);

  H('what a first visit costs');
  console.log(`  requests to us       ${reqs.length}`);
  console.log(`  bytes from us        ${Math.round(bytes / 1024)} KB uncompressed`);
  reqs.sort((a, c) => c.kb - a.kb).slice(0, 4).forEach(r => console.log(`     ${String(r.kb).padStart(4)} KB  ${r.p}`));
  const perf = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    const paint = performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint');
    return { dom: Math.round(n.domContentLoadedEventEnd || 0), fcp: Math.round(paint ? paint.startTime : 0),
             third: performance.getEntriesByType('resource')
               .filter(r => !r.name.includes('localhost') && !r.name.startsWith('data:'))
               .map(r => r.name.replace(/^https?:\/\//, '').split('/')[0]) };
  });
  console.log(`  DOM ready            ${perf.dom} ms   first paint ${perf.fcp} ms  (local network)`);
  console.log(`  third-party hosts    ${[...new Set(perf.third)].join(', ') || 'none'}`);

  H('too small to hit reliably  (Apple 44px, Google 48px)');
  const small = await page.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('on'));
    const out = new Set();
    document.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role=button]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.height < 40) {
        const t = (el.textContent || el.getAttribute('aria-label') || el.id || el.className || '').trim().replace(/\s+/g,' ').slice(0, 32);
        out.add(`${Math.round(r.width)}×${Math.round(r.height)}  ${t}`);
      }
    });
    return [...out];
  });
  console.log(small.length ? small.slice(0, 12).map(s => '  ' + s).join('\n') : '  none');
  if (small.length > 12) console.log(`  …and ${small.length - 12} more`);

  H('text below the contrast floor');
  const faint = await page.evaluate(() => {
    const lum = c => {
      const p = (c.match(/[\d.]+/g) || ['0','0','0']).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    };
    const bgl = lum('rgb(12,10,7)');
    const seen = new Map();
    document.querySelectorAll('p,span,b,i,small,li,label,a,button,div').forEach(el => {
      if (el.children.length || !el.textContent || el.textContent.trim().length < 3) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.9) return;
      const size = parseFloat(cs.fontSize), fg = lum(cs.color);
      const ratio = (Math.max(fg, bgl) + 0.05) / (Math.min(fg, bgl) + 0.05);
      const need = (size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight) >= 700)) ? 3 : 4.5;
      if (ratio < need) {
        const k = cs.color + Math.round(size);
        if (!seen.has(k)) seen.set(k, { r: Math.round(ratio*10)/10, need, size: Math.round(size),
          color: cs.color, s: el.textContent.trim().replace(/\s+/g,' ').slice(0, 28) });
      }
    });
    return [...seen.values()].sort((a, c) => a.r - c.r);
  });
  console.log(faint.length ? faint.slice(0, 8).map(f =>
    `  ${String(f.r).padStart(4)}:1 needs ${f.need}   ${f.size}px ${f.color.padEnd(22)} "${f.s}"`).join('\n')
    : '  all text passes');

  H('fields with nothing naming them');
  const un = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(el => {
      const has = (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label') ||
                  el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder');
      if (!has) out.push(el.id || el.name || el.className || el.tagName);
    });
    return out;
  });
  console.log(un.length ? un.map(u => '  ' + u).join('\n') : '  every field is named');

  H('images with no alt attribute');
  const noalt = await page.evaluate(() =>
    [...document.querySelectorAll('img')].filter(i => i.getAttribute('alt') === null)
      .map(i => (i.getAttribute('src') || '?').split('/').pop()));
  console.log(noalt.length ? noalt.map(n => '  ' + n).join('\n') : '  none');

  H('what each screen asks of somebody');
  const screens = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.screen').forEach(s => {
      document.querySelectorAll('.screen').forEach(x => x.classList.remove('on'));
      s.classList.add('on');
      const txt = (s.innerText || '').replace(/\s+/g, ' ').trim();
      out.push({ id: s.id.replace('scr-', ''), words: txt.split(' ').filter(Boolean).length,
        press: s.querySelectorAll('button, a[href], input, select, textarea').length,
        tall: Math.round(s.scrollHeight / window.innerHeight * 10) / 10 });
    });
    return out.sort((a, b) => b.press - a.press);
  });
  console.log('  screen        words  controls  screenfuls');
  screens.forEach(s => console.log(`  ${s.id.padEnd(12)} ${String(s.words).padStart(5)} ${String(s.press).padStart(9)} ${String(s.tall).padStart(11)}`));

  H('errors');
  console.log('  JS:      ' + (errs.length ? errs.join(' | ') : 'none'));
  console.log('  console: ' + (warns.length ? [...new Set(warns)].join(' | ') : 'none'));

  await b.close(); srv.close();
})();
