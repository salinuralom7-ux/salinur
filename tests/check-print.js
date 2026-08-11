/* What actually comes out of the print path: the print-media layout, and a
   real PDF rendered by the browser's own print pipeline. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const OUT = '/tmp/claude-0/-home-user-salinur/5804f10d-9047-5141-886a-31b320556fa3/scratchpad/';
const T = {'.html':'text/html','.js':'application/javascript','.json':'application/json',
           '.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8819);

const ok = (l, c, e) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (e !== undefined ? '  → ' + e : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8819/');
  await p.waitForTimeout(1200);

  await p.evaluate(() => {
    const w = demoAll()[0];
    w.name = 'Salinur Pramanik'; w.area = 'Fancy Bazar'; w.city = 'Guwahati';
    w.status = 'approved'; w.verified = true;
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession(); go('card');
  });
  await p.waitForTimeout(900);
  ok('Card is on screen', await p.locator('#idCard').count() === 1);

  // ---- the button must actually reach a print dialog ----
  await p.evaluate(() => {
    window.__printed = [];
    const orig = window.print;
    window.print = function(){ window.__printed.push('page'); };
    // catch the frame's print too, whichever the code chooses
    const oc = HTMLIFrameElement.prototype;
    Object.defineProperty(window, '__origPrint', { value: orig });
  });
  await p.exposeFunction('__notePrint', () => {});
  await p.locator('#printCardBtn').click();
  await p.waitForTimeout(3200);
  const frameCount = await p.evaluate(() => document.querySelectorAll('iframe').length);
  ok('Clicking the button builds a print document', frameCount === 1, frameCount + ' frame(s)');
  const inner = await p.evaluate(() => {
    const f = document.querySelector('iframe');
    if(!f || !f.contentDocument) return null;
    const c = f.contentDocument.getElementById('idCard');
    if(!c) return null;
    const r = c.getBoundingClientRect();
    const d = f.contentDocument;
    return {
      onlyTheCard: d.body.children.length === 1 && d.body.firstElementChild.id === 'idCard',
      cardMm: [+(r.width*25.4/96).toFixed(1), +(r.height*25.4/96).toFixed(1)],
      bodyMm: +(d.body.scrollHeight*25.4/96).toFixed(1),
      hasPageRule: [...d.querySelectorAll('style')].some(s => /@page\s*\{\s*size:85\.6mm 54mm/.test(s.textContent)),
      wordmarkLoaded: (() => { const i = d.querySelector('.bd-wordmark'); return !!i && i.complete && i.naturalWidth > 0; })(),
      qr: d.querySelectorAll('.bd-qr svg').length,
    };
  });
  console.log('      print doc:', JSON.stringify(inner));
  ok('The document holds only the card', inner && inner.onlyTheCard);
  ok('The card is exactly CR80 in it', inner && Math.abs(inner.cardMm[0]-85.6)<0.6 && Math.abs(inner.cardMm[1]-54)<0.6, inner && inner.cardMm.join(' x '));
  ok('Its body is one page tall', inner && Math.abs(inner.bodyMm-54)<1, inner && inner.bodyMm);
  ok('It sets the page size itself', inner && inner.hasPageRule);
  ok('Images resolve inside it', inner && inner.wordmarkLoaded);
  ok('The code came with it', inner && inner.qr === 1);
  await p.evaluate(() => { const f=document.querySelector('iframe'); if(f) f.remove(); });

  // ---- print media: what survives, and how big ----
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const c = document.querySelector('#idCard');
    const r = c.getBoundingClientRect();
    const vis = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).display : 'absent'; };
    return {
      card: [Math.round(r.width), Math.round(r.height)],
      ratio: +(r.width / r.height).toFixed(3),
      cardDisplay: getComputedStyle(c).display,
      header: vis('body > header'), footer: vis('footer'),
      actions: vis('.card-actions'), note: vis('.card-note'),
      // does the cqw sizing survive the switch to mm?
      nameSize: getComputedStyle(document.querySelector('.bd-name')).fontSize,
      idSize: getComputedStyle(document.querySelector('.bd-idnum')).fontSize,
      overflowing: [...c.querySelectorAll('*')].filter(el => {
        const bb = el.getBoundingClientRect();
        return bb.width > 0 && (bb.right > r.right + 1.5 || bb.left < r.left - 1.5);
      }).map(el => el.className).slice(0, 6),
    };
  });
  console.log('      print metrics:', JSON.stringify(m));
  ok('Card survives print media', m.cardDisplay !== 'none');
  ok('Furniture is hidden', m.header === 'none' && m.footer === 'none' && m.actions === 'none' && m.note === 'none');
  ok('Card keeps CR80 in print', Math.abs(m.ratio - 85.6 / 54) < 0.03, m.ratio);
  ok('Type still scales in print', parseFloat(m.nameSize) > 6, m.nameSize + ' / ' + m.idSize);
  ok('Nothing overflows in print', m.overflowing.length === 0, m.overflowing.join(', ') || 'none');
  await p.emulateMedia({ media: null });

  // ---- the real thing: the browser's own PDF pipeline ----
  try {
    const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    fs.writeFileSync(OUT + 'card-print.pdf', pdf);
    ok('A PDF is produced', pdf.length > 2000, pdf.length + ' bytes');
    const head = pdf.subarray(0, 900).toString('latin1');
    const mb = head.match(/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (mb) {
      const wpt = +mb[3], hpt = +mb[4];
      const mm = v => +(v * 25.4 / 72).toFixed(1);
      console.log('      page size:', mm(wpt) + 'mm x ' + mm(hpt) + 'mm  (want 85.6 x 54)');
      ok('Page is the card, not A4', Math.abs(mm(wpt) - 85.6) < 2 && Math.abs(mm(hpt) - 54) < 2);
    } else console.log('      could not read MediaBox');
    ok('One page only', (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 1,
       (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length + ' pages');
  } catch (e) { ok('A PDF is produced', false, e.message); }

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
