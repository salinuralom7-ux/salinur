/* The home screen was rebuilt to a brief: one sentence, twelve faces, one
   button, then a banner slot that hides itself when empty. */
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT='/home/user/salinur/docs';
const T={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.css':'text/css','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8845);
const ok=(l,c,x)=>{console.log((c?'PASS  ':'FAIL  ')+l+(x!==undefined?'  → '+x:''));if(!c)process.exitCode=1;};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await (await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})).newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://localhost:8845/'); await page.waitForTimeout(1600);

  // ---------- one sentence, and only one ----------
  ok('The first line is the one asked for',
     (await page.locator('.home-title').innerText()).trim() === 'Trusted Service Provider Near You');
  ok('…on a single line',
     await page.evaluate(() => {
       const el = document.querySelector('.home-title'), cs = getComputedStyle(el);
       return Math.round(el.getBoundingClientRect().height / parseFloat(cs.lineHeight)) === 1;
     }));
  ok('Nothing else above the services',
     await page.locator('#scr-home .cta').count() === 0);
  ok('The two big cards are gone', await page.locator('#ctaWork').count() === 0);
  ok('And so is the scrolling band', await page.locator('#scr-home .ticker').count() === 0);

  // ---------- twelve, four across ----------
  ok('Twelve services', await page.locator('.qtile').count() === 12);
  const cols = await page.evaluate(() => {
    const t = [...document.querySelectorAll('.qtile')].map(e => Math.round(e.getBoundingClientRect().top));
    return t.filter(y => y === t[0]).length;
  });
  ok('Four across, so three rows', cols === 4, cols + ' in the first row');

  // ---------- the button ----------
  const see = page.locator('.see-all');
  ok('The button says See all services', (await see.innerText()).trim() === 'See all services');
  await see.click(); await page.waitForTimeout(900);
  ok('…and it opens the results', await page.locator('#scr-hire.on').count() === 1);
  await page.locator('#tabHome').click(); await page.waitForTimeout(700);

  // ---------- proportions ----------
  const share = await page.evaluate(() => {
    const H = window.innerHeight;
    const r = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().height / H : 0; };
    const head = document.querySelector('.home-top').getBoundingClientRect().height / H;
    const grid = document.getElementById('quickGrid').getBoundingClientRect().height / H;
    const btn  = document.querySelector('.see-all').getBoundingClientRect().height / H;
    return { head: +(head*100).toFixed(1), grid: +(grid*100).toFixed(1), btn: +(btn*100).toFixed(1) };
  });
  ok('The sentence is about a tenth of the screen', share.head >= 5 && share.head <= 16, share.head + '%');
  ok('The services take a third or so', share.grid >= 28 && share.grid <= 45, share.grid + '%');
  ok('The button is about a tenth', share.btn >= 4 && share.btn <= 14, share.btn + '%');

  // ---------- the banner ----------
  ok('The banner is hidden while there is nothing to show',
     await page.locator('#adBand').isVisible() === false);
  // and it appears, rotates and links out when there is
  await page.evaluate(() => {
    adBanners = [
      { slot:1, image_url:'icons/icon-192.png', link_url:'https://example.com', alt:'One' },
      { slot:2, image_url:'icons/icon-512.png', link_url:null, alt:'Two' }
    ];
    document.getElementById('adBandTrack').innerHTML = adBanners.map(b => {
      const img = `<img src="${b.image_url}" alt="${b.alt}">`;
      return b.link_url
        ? `<a class="adband-slide" href="${b.link_url}" target="_blank" rel="noopener noreferrer nofollow">${img}</a>`
        : `<span class="adband-slide">${img}</span>`;
    }).join('');
    document.getElementById('adBandDots').innerHTML = adBanners.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('');
    document.getElementById('adBand').hidden = false;
    showBanner(0);
  });
  await page.waitForTimeout(400);
  ok('With banners it shows', await page.locator('#adBand').isVisible());
  ok('One dot per banner', await page.locator('#adBandDots i').count() === 2);
  ok('A banner that links out cannot reach back',
     await page.locator('.adband-slide[href]').getAttribute('rel') === 'noopener noreferrer nofollow');
  ok('…and opens away from the app',
     await page.locator('.adband-slide[href]').getAttribute('target') === '_blank');
  await page.evaluate(() => showBanner(1)); await page.waitForTimeout(300);
  ok('It moves to the next one',
     /translateX\(-100/.test(await page.evaluate(() => document.getElementById('adBandTrack').style.transform)));
  ok('…and wraps round to the first',
     await page.evaluate(() => { showBanner(2); return adIndex; }) === 0);

  // ---------- what survived ----------
  ok('The counts are still there', /\d/.test(await page.locator('#figServices').innerText()));
  ok('How it works is still there', await page.locator('.stepbar li').count() === 3);
  ok('The header offers My profile',
     (await page.locator('#profileLink').innerText()).trim() === 'My profile');
  /* and it reads as something you press, not as an aside */
  const btn = await page.evaluate(() => {
    const el = document.getElementById('profileLink'), cs = getComputedStyle(el);
    const dot = document.getElementById('menuBtn').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { border: cs.borderTopWidth, radius: parseFloat(cs.borderTopLeftRadius),
             bg: cs.backgroundColor, icon: !!el.querySelector('svg'),
             level: Math.abs(Math.round(r.top - dot.top)) <= 1,
             h: Math.round(r.height), dotH: Math.round(dot.height) };
  });
  ok('It looks like a button', parseFloat(btn.border) > 0 && btn.radius >= 8 &&
     btn.bg !== 'rgba(0, 0, 0, 0)', JSON.stringify(btn));
  ok('…with an icon, and level with the menu button',
     btn.icon && btn.level && btn.h === btn.dotH, `${btn.h}px vs ${btn.dotH}px`);

  ok('No horizontal overflow',
     await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok('No JS errors', errs.length === 0, errs.join(' | ') || 'none');
  await b.close(); srv.close();
})();
