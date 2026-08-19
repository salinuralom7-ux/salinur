/* What the app does when something breaks.

   Every error state in here told somebody what had gone wrong and then left
   them standing there. "Couldn't load service experts — check your
   connection and try again" is not a way to try again: on a results screen
   there is nothing to pull and no button to press, so the only route back
   was to leave the screen and come in again, which somebody has to guess.

   The chat error was worse in a different way — it printed the raw thrown
   message to the screen, so a customer read "Failed to fetch", which names
   a problem they cannot act on and sounds like their conversation is gone.

   What this guards is not that the words are nice. It is that the button is
   there, that it actually retries, and that recovering leaves the screen in
   the state it would have been in had nothing gone wrong. */
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
}).listen(8858);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce',
    geolocation: { latitude: 26.1445, longitude: 91.7362 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8858/'); await page.waitForTimeout(1800);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {}; });

  // ---------- the search that fails ----------
  await page.evaluate(() => {
    window._realSearch = api.search;
    api.search = async () => { throw new Error('Failed to fetch'); };
    go('hire');
  });
  await page.waitForTimeout(1600);

  const err = await page.evaluate(() => {
    const e = document.querySelector('#results .empty.is-error');
    const btn = e && e.querySelector('.empty-act');
    return { there: !!e, text: e ? e.innerText.replace(/\s+/g, ' ').trim() : '',
             btn: !!btn, label: btn ? btn.textContent.trim() : '',
             tall: btn ? Math.round(btn.getBoundingClientRect().height) : 0,
             icon: !!(e && e.querySelector('.empty-ico')) };
  });
  ok('A failed search says so', err.there, err.text.slice(0, 74));
  ok('…and looks different from an empty shelf', err.icon);
  ok('…and offers a way out rather than an instruction', err.btn, err.label);
  ok('…on a button a thumb can hit', err.tall >= 40, err.tall + 'px');
  ok('…and does not print the thrown message at the reader',
     !/Failed to fetch/i.test(err.text), err.text.slice(0, 74));

  // ---------- and the way out actually works ----------
  await page.evaluate(() => { api.search = window._realSearch; });
  await page.locator('#results .empty-act').click();
  await page.waitForTimeout(1600);
  ok('Pressing it retries, and the list comes back',
     await page.locator('.wcard').count() > 0,
     (await page.locator('.wcard').count()) + ' workers');
  ok('…and the error is gone with it',
     await page.locator('#results .empty.is-error').count() === 0);

  // ---------- the conversation that will not open ----------
  await page.evaluate(() => {
    window._realThread = api.threadMessages || null;
    chatCode = 'DEMO1'; chatSide = 'customer';
    api.threadMessages = async () => { throw new Error('Failed to fetch'); };
    go('chat');
    refreshChat(true);
  });
  await page.waitForTimeout(1200);
  const chat = await page.evaluate(() => {
    const e = document.querySelector('#chatLog .empty.is-error');
    return { there: !!e, text: e ? e.innerText.replace(/\s+/g, ' ').trim() : '',
             btn: !!(e && e.querySelector('.empty-act')) };
  });
  ok('A conversation that will not load says so', chat.there, chat.text.slice(0, 78));
  ok('…reassures that nothing was lost, which is the actual fear',
     /still there|not a lost message/i.test(chat.text));
  ok('…never shows the raw thrown message', !/Failed to fetch/i.test(chat.text));
  ok('…and offers to try again', chat.btn);

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
