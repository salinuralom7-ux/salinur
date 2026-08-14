/* Booking the same person again.

   The pattern Swiggy and Zomato put first on the home screen, for the reason
   they put it there: a repeat is the cheapest booking there is. For a service
   expert it is worth more than a new customer — somebody who already knows
   the house, the tap, the child being tutored.

   Two entry points, and the important behaviour is the same in both: the
   check on whether that person is still working happens at the moment of
   tapping, not when the list is drawn, because that is the only moment the
   answer has to be right. If they have gone, the customer must not be left
   staring at a dead button. */
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
}).listen(8847);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8847/'); await page.waitForTimeout(2000);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {}; });

  // ---------- nothing for somebody who has never booked ----------
  ok('The home screen is unchanged for somebody who has never booked',
     await page.locator('#againWrap').isVisible() === false);

  // ---------- the strip ----------
  const seed = await page.evaluate(() => {
    const all = demoAll();
    /* the same person twice, to prove the list is by person and not by booking */
    const recs = [
      { code:'AAA1', token:'t1', worker:all[0].name, workerId:all[0].id,
        skill:all[0].skills[1].skill, at:new Date().toISOString() },
      { code:'AAA2', token:'t2', worker:all[3].name, workerId:all[3].id,
        skill:all[3].skills[0].skill, at:new Date(Date.now()-8.64e7).toISOString() },
      { code:'AAA3', token:'t3', worker:all[0].name, workerId:all[0].id,
        skill:all[0].skills[0].skill, at:new Date(Date.now()-1.7e8).toISOString() },
      /* an old booking from before a booking recorded who it was with */
      { code:'AAA4', token:'t4', worker:'Someone Old', skill:'Plumber',
        at:new Date(Date.now()-3e8).toISOString() },
    ];
    localStorage.setItem('repto_my_bookings_v1', JSON.stringify(recs));
    paintMineLink();
    return { first: all[0].name, firstId: all[0].id,
             mostRecentSkill: all[0].skills[1].skill,
             second: all[3].name };
  });

  ok('The strip appears once there is a booking behind you',
     await page.locator('#againWrap').isVisible());
  const faces = await page.locator('#againRow .again').count();
  ok('One entry per person, not per booking', faces === 2, faces + ' entries from 4 bookings');
  const names = await page.locator('#againRow .again b').allInnerTexts();
  ok('Most recent first', names[0] === seed.first.split(' ')[0], names.join(', '));
  ok('A booking with nobody recorded on it is skipped rather than shown blank',
     !names.includes('Someone'), names.join(', '));

  // ---------- tapping opens that person ----------
  await page.locator('#againRow .again').first().click();
  await page.waitForTimeout(700);
  const opened = await page.evaluate(() => ({
    open: document.getElementById('wOverlay').classList.contains('open'),
    who: (document.querySelector('#wDetail h3') || {}).textContent || '',
    picked: (document.querySelector('.price-line.on b') || {}).textContent || '',
  }));
  ok('It opens that exact person', opened.open && opened.who.trim() === seed.first, opened.who);
  ok('…on the trade they did last time, not the first in their list',
     opened.picked.trim() === seed.mostRecentSkill, opened.picked);
  await page.evaluate(() => closeModal('wOverlay')); await page.waitForTimeout(300);

  // ---------- somebody who has stopped working ----------
  await page.evaluate(() => { window.__realCard = api.workerCard; api.workerCard = async () => null; });
  await page.locator('#againRow .again').first().click();
  await page.waitForTimeout(900);
  const gone = await page.evaluate(() => ({
    screen: currentScreen,
    modal: document.getElementById('wOverlay').classList.contains('open'),
    toast: (document.querySelector('.toast') || {}).textContent || '',
  }));
  ok('Somebody who has stopped working does not open a bookable profile', !gone.modal);
  ok('…the customer is told', /not taking work/i.test(gone.toast), gone.toast.slice(0, 60));
  ok('…and is put in front of that trade instead of a dead end',
     gone.screen === 'hire', gone.screen);
  await page.evaluate(() => { api.workerCard = window.__realCard; });

  // ---------- the same thing from the Bookings screen ----------
  await page.evaluate(() => {
    /* one finished booking and one still running, both the customer's */
    const all = demoAll();
    myConversations = async () => ([
      { code:'AAA1', side:'customer', status:'closed', worker_id: all[0].id,
        worker_name: all[0].name, who: all[0].name, sub:'Electrician',
        when: new Date(), unread:0 },
      { code:'AAA9', side:'customer', status:'accepted', worker_id: all[3].id,
        worker_name: all[3].name, who: all[3].name, sub:'Plumber',
        when: new Date(), unread:0 },
      { code:'AAA8', side:'worker', status:'closed', worker_id: all[1].id,
        worker_name: all[1].name, who:'A customer', sub:'Tutor',
        when: new Date(), unread:0 },
    ]);
    go('chats');
  });
  await page.waitForTimeout(900);
  const rows = await page.evaluate(() => ({
    total: document.querySelectorAll('.thread-row').length,
    again: [...document.querySelectorAll('.tr-again')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    nested: document.querySelectorAll('.thread-row button').length,
  }));
  ok('A finished booking offers it again', rows.again.length === 1, rows.again.join(' | '));
  ok('…naming the person', /Rahim/.test(rows.again[0] || ''), rows.again[0]);
  ok('A booking still in progress does not', rows.total === 3 && rows.again.length === 1);
  ok('No button is nested inside another button', rows.nested === 0, rows.nested + ' nested');

  await page.locator('.tr-again').first().click();
  await page.waitForTimeout(800);
  ok('And it opens the same profile from there',
     await page.evaluate(() => document.getElementById('wOverlay').classList.contains('open')));

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
