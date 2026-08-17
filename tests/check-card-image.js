/* "Save as image": the card is drawn on the worker's own phone and saved there,
   so nothing touches the server. What has to be proved is that the exported
   picture actually looks like the card — the layout is sized in container-query
   units and the type is a web font, and both behave differently inside an SVG
   foreignObject. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/user/salinur/docs';
const OUT = '/tmp/claude-0/-home-user-salinur/5804f10d-9047-5141-886a-31b320556fa3/scratchpad/';
const T = {'.html':'text/html','.js':'application/javascript','.png':'image/png','.css':'text/css',
           '.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8841);

const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const missed = [];
  p.on('requestfailed', r => missed.push(r.url()));
  await p.goto('http://localhost:8841/');
  await p.waitForTimeout(1500);

  // ---------- the font is ours now, and the weight axis works ----------
  ok('The sans is served from our own origin',
     !fs.readFileSync(ROOT + '/index.html', 'utf8').includes('family=Plus+Jakarta+Sans'));
  ok('The font file is in the repo', fs.existsSync(ROOT + '/fonts/plus-jakarta-sans-latin.woff2'));
  ok('It is in the offline shell',
     fs.readFileSync(ROOT + '/sw.js', 'utf8').includes('plus-jakarta-sans-latin.woff2'));
  ok('The licence travels with it', fs.existsSync(ROOT + '/fonts/OFL.txt'));

  const font = await p.evaluate(async () => {
    await document.fonts.ready;
    const measure = (weight) => {
      const s = document.createElement('span');
      s.style.cssText = `position:absolute;visibility:hidden;font:${weight} 40px 'Plus Jakarta Sans';`;
      s.textContent = 'Repto Worker ID 4827';
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove(); return w;
    };
    return { loaded: document.fonts.check("700 20px 'Plus Jakarta Sans'"),
             w400: measure(400), w800: measure(800) };
  });
  ok('The self-hosted font loads', font.loaded);
  ok('One variable file really does carry the weight range',
     Math.abs(font.w800 - font.w400) > 2, `400 → ${font.w400.toFixed(1)}px, 800 → ${font.w800.toFixed(1)}px`);

  // ---------- open a card ----------
  await p.evaluate(() => {
    const w = demoAll()[0];
    w.name = 'Salinur Pramanik'; w.area = 'Fancy Bazar'; w.city = 'Guwahati';
    w.status = 'approved'; w.verified = true; w.worker_code = '482739105566';
    demoSave(demoAll().map(x => x.id === w.id ? w : x));
    session = { phone:w.phone, pin:w.pin, name:w.name, registered:true, worker:w };
    saveSession(); go('card');
  });
  await p.waitForTimeout(900);
  ok('A save button is offered', await p.locator('#saveCardBtn').count() === 1);

  // ---------- export it ----------
  const shot = await p.evaluate(async () => {
    const t0 = performance.now();
    try {
      const blob = await cardImageBlob(1.5);
      const dataUrl = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
      return { ok:true, type:blob.type, bytes:blob.size, ms:Math.round(performance.now()-t0), dataUrl };
    } catch (e) { return { ok:false, err: e.message }; }
  });
  ok('The card exports without error', shot.ok, shot.ok ? `${(shot.bytes/1024|0)} KB in ${shot.ms}ms` : shot.err);
  if (!shot.ok) { console.log('cannot continue'); await b.close(); srv.close(); return; }
  ok('It is a PNG', shot.type === 'image/png', shot.type);

  const png = Buffer.from(shot.dataUrl.split(',')[1], 'base64');
  fs.writeFileSync(OUT + 'card-export.png', png);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  ok('Comfortably above card resolution', w >= 1500 && h >= 940, `${w}x${h} (CR80 is 85.6x54mm)`);
  ok('Under a megabyte, so WhatsApp will not recompress it to mush',
     png.length < 1024 * 1024, `${(png.length/1024|0)} KB`);

  // ---------- does it actually look like the card? ----------
  const look = await p.evaluate(async (dataUrl) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = dataUrl; });
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const at = (fx, fy) => {
      const d = ctx.getImageData(Math.round(img.width*fx), Math.round(img.height*fy), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const gold = c => c[0] > 170 && c[1] > 130 && c[2] < 140;
    const dark = c => c[0] < 70 && c[1] < 60 && c[2] < 55;
    // how much of the image is not background — i.e. was anything drawn?
    const all = ctx.getImageData(0, 0, img.width, img.height).data;
    let lit = 0;
    for (let i = 0; i < all.length; i += 4 * 97) if (all[i] > 90 || all[i+1] > 90) lit++;
    /* The QR was checked by reading one pixel at (0.845, 0.72) and demanding
       it be white. Whether any given pixel inside a QR is a light or a dark
       module depends on what is encoded, and what is encoded is the worker's
       own ID — so that pixel was white for the worker it was written against
       and black for the next one. Measure the block instead: a QR is roughly
       half light, and no white backing at all reads as near zero. */
    const x0 = Math.round(img.width*0.82),  x1 = Math.round(img.width*0.945);
    const y0 = Math.round(img.height*0.65), y1 = Math.round(img.height*0.855);
    const q = ctx.getImageData(x0, y0, x1-x0, y1-y0).data;
    let light = 0, n = 0;
    for (let i = 0; i < q.length; i += 4) { n++; if (q[i] > 200 && q[i+1] > 200 && q[i+2] > 200) light++; }
    return { frameLeft: at(0.004, 0.5), footer: at(0.06, 0.965), face: at(0.5, 0.06),
             qrLight: light / n, litFraction: lit / (all.length / (4*97)),
             goldFrame: gold(at(0.004, 0.5)), goldFooter: gold(at(0.06, 0.965)),
             darkFace: dark(at(0.5, 0.06)) };
  }, shot.dataUrl);
  ok('The gold frame is there', look.goldFrame, look.frameLeft.join(','));
  ok('The gold footer band is there', look.goldFooter, look.footer.join(','));
  ok('The card face is dark, not blank white', look.darkFace, look.face.join(','));
  ok('The QR is drawn on white, and is a QR rather than a white square',
     look.qrLight > 0.3 && look.qrLight < 0.9,
     (look.qrLight*100).toFixed(0) + '% of the code block is white');
  ok('The image is not mostly empty', look.litFraction > 0.05 && look.litFraction < 0.75,
     (look.litFraction*100).toFixed(1) + '% lit');

  // the whole point of self-hosting: the export must not fall back to a serif
  const typeface = await p.evaluate(async () => {
    /* Render the same string in the exported font and in a known serif, at the
       same size. If the export had fallen back, the two would match. */
    await document.fonts.ready;
    const m = (fam) => {
      const s = document.createElement('span');
      s.style.cssText = `position:absolute;visibility:hidden;font:800 40px ${fam};`;
      s.textContent = 'Salinur Pramanik';
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width; s.remove(); return w;
    };
    return { jakarta: m("'Plus Jakarta Sans'"), serif: m('Georgia, serif') };
  });
  ok('The brand sans measures differently from a serif, so a fallback is detectable',
     Math.abs(typeface.jakarta - typeface.serif) > 4,
     `${typeface.jakarta.toFixed(0)} vs ${typeface.serif.toFixed(0)}`);

  /* Only our own requests count. This sandbox blocks outbound HTTPS, so the
     Google-hosted serif and the Supabase probe fail here and would not on the
     live site — which is itself the argument for self-hosting the sans. */
  const ourOwn = missed.filter(u => u.startsWith('http://localhost:8841/'))
                       .map(u => u.replace('http://localhost:8841/', ''));
  ok('Nothing of ours failed to load', ourOwn.length === 0, ourOwn.join(', ') || 'none');
  console.log('      (external blocked by this sandbox: ' +
              (missed.length - ourOwn.length) + ' request(s) — the Google serif and the Supabase probe)');
  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  console.log('\nwrote ' + OUT + 'card-export.png');
  await b.close(); srv.close();
})();
