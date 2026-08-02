/* The landing card has to say, without being opened, that something is
   waiting. Three separate reasons feed it — an unread message, a request only
   you can answer, and a status the other side changed while you were away —
   and each one has a different way of going wrong, so each is driven here
   rather than asserted from one happy path.

   Everything below works on the pure functions plus the painted DOM. It never
   needs a live database: needsYou() is handed rows in the shape
   myConversations() returns, which is the shape the real thing paints from. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8831);

let failed = 0;
const ok = (label, cond, extra) => {
  if (!cond) failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));
};

const row = o => Object.assign({
  code: 'C1', side: 'customer', status: 'requested', unread: 0, who: 'Someone', sub: '', when: new Date()
}, o);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8831/');
  await p.waitForTimeout(900);

  // ---------- what counts as waiting ----------
  const verdicts = await p.evaluate(rows => {
    localStorage.removeItem('repto_seen_v1');
    // C1 already looked at, at "accepted"; C6 already looked at, at "done"
    const seen = { C1: 'accepted', C6: 'done' };
    return rows.map(r => [needsYou(r, seen), needsYourAnswer(r)]);
  }, [
    row({ status: 'requested' }),                                  // 0 you sent it, nothing to see
    row({ status: 'requested', side: 'worker' }),                  // 1 only you can answer
    row({ status: 'accepted' }),                                   // 2 already seen at this status
    row({ status: 'declined' }),                                   // 3 changed since you looked
    row({ status: 'cancelled' }),                                  // 4 changed since you looked
    row({ status: 'done' }),                                       // 5 only you can confirm
    row({ status: 'done', side: 'worker', code: 'C6' }),           // 6 waiting on the customer, not you
    row({ status: 'closed', code: 'ZZ' }),                         // 7 never seen at all
    row({ status: 'accepted', unread: 2 })                         // 8 seen, but unread messages
  ]);

  ok('A request you just sent is not "waiting on you"',      verdicts[0][0] === false);
  ok('A request on the worker\'s side is',                   verdicts[1][0] === true);
  ok('A status you have already seen is not',                verdicts[2][0] === false);
  ok('A decline you have not seen is',                       verdicts[3][0] === true);
  ok('A cancellation you have not seen is',                  verdicts[4][0] === true);
  ok('"Finished — confirm" is waiting on the customer',      verdicts[5][0] === true);
  ok('…and is an action, so it survives being seen',         verdicts[5][1] === true);
  ok('The worker who marked it done is not nagged to confirm',
     verdicts[6][0] === false && verdicts[6][1] === false);
  ok('An unseen conversation counts',                        verdicts[7][0] === true);
  ok('Unread messages count even at a seen status',          verdicts[8][0] === true);

  // ---------- the first run does not shout about history ----------
  const firstRun = await p.evaluate(rows => {
    localStorage.removeItem('repto_seen_v1');
    const seen = seenForBadge(rows);
    return {
      waiting: rows.filter(t => needsYou(t, seen)).length,
      stored: Object.keys(JSON.parse(localStorage.getItem('repto_seen_v1') || '{}')).length
    };
  }, [row({ code: 'A', status: 'closed' }), row({ code: 'B', status: 'declined' })]);

  ok('An old finished job does not go red on first ever run', firstRun.waiting === 0, firstRun.waiting);
  ok('…because the first sighting is recorded',               firstRun.stored === 2, firstRun.stored);

  // ---------- but a real pending action still shows on first run ----------
  const firstRunAction = await p.evaluate(rows => {
    localStorage.removeItem('repto_seen_v1');
    const seen = seenForBadge(rows);
    return rows.filter(t => needsYou(t, seen)).length;
  }, [row({ code: 'A', status: 'closed' }), row({ code: 'B', side: 'worker', status: 'requested' })]);

  ok('A request needing an answer still shows on first run', firstRunAction === 1, firstRunAction);

  // ---------- the card actually turns red ----------
  const painted = await p.evaluate(rows => {
    localStorage.setItem('repto_seen_v1', '{}');
    document.getElementById('myBookingsLink').hidden = false;
    paintChatBadge(rows);
    const link = document.getElementById('myBookingsLink');
    const dot = document.getElementById('myBookingsDot');
    const cs = getComputedStyle(dot);
    return {
      waiting: link.classList.contains('waiting'),
      urgent: dot.classList.contains('urgent'),
      hidden: dot.hidden,
      count: dot.textContent,
      colour: cs.backgroundColor,
      dangerRgb: (() => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--danger)';
        document.body.appendChild(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
      })(),
      animation: cs.animationName,
      sub: document.getElementById('myBookingsSub').textContent,
      menuDot: document.getElementById('menuDot').classList.contains('urgent'),
      drawer: document.getElementById('chatsBadge').textContent
    };
  }, [row({ code: 'A', side: 'worker', status: 'requested' }),
      row({ code: 'B', status: 'accepted', unread: 3 })]);

  ok('The card is marked as waiting',        painted.waiting === true);
  ok('The badge is shown',                   painted.hidden === false);
  ok('The badge counts conversations',       painted.count === '2', painted.count);
  /* Compare against the palette rather than a literal. Hard-coding the value
     made a palette change look like a broken badge, which is the second time
     a colour literal in a test has accused working code. What matters is that
     the badge is painted --danger and that --danger is actually red. */
  ok('The badge is painted --danger', painted.colour === painted.dangerRgb,
     `${painted.colour} vs ${painted.dangerRgb}`);
  ok('…and --danger is a red', (() => {
    const [r, g, b] = painted.colour.match(/\d+/g).map(Number);
    return r > 150 && r > g * 1.8 && r > b * 1.8;
  })(), painted.colour);
  ok('The badge pulses',                     painted.animation === 'waiting-pulse', painted.animation);
  ok('The menu dot agrees',                  painted.menuDot === true);
  ok('The drawer row agrees',                painted.drawer === '2', painted.drawer);
  ok('The subtitle says what is waiting',
     painted.sub === '1 to answer · 3 new messages', painted.sub);

  // ---------- and goes back to normal when nothing is ----------
  const cleared = await p.evaluate(() => {
    paintChatBadge([]);
    const dot = document.getElementById('myBookingsDot');
    return {
      waiting: document.getElementById('myBookingsLink').classList.contains('waiting'),
      hidden: dot.hidden,
      urgent: dot.classList.contains('urgent'),
      menuDot: document.getElementById('menuDot').hidden
    };
  });
  ok('Nothing waiting: the card is ordinary again', cleared.waiting === false);
  ok('…the badge is hidden',                        cleared.hidden === true);
  ok('…and it is no longer urgent',                 cleared.urgent === false);
  ok('…and the menu dot is gone',                   cleared.menuDot === true);

  // ---------- seen is per conversation, and survives a reload ----------
  const persisted = await p.evaluate(() => {
    localStorage.setItem('repto_seen_v1', '{}');
    markSeen('X1', 'declined');
    markSeen('X1', 'declined');            // twice must not double up
    return JSON.parse(localStorage.getItem('repto_seen_v1'));
  });
  ok('markSeen records the status', persisted.X1 === 'declined', JSON.stringify(persisted));

  await p.reload();
  await p.waitForTimeout(700);
  const afterReload = await p.evaluate(() =>
    needsYou({ code: 'X1', side: 'customer', status: 'declined', unread: 0 }, seenMap()));
  ok('A decline stays seen across a reload', afterReload === false);

  const changedAgain = await p.evaluate(() =>
    needsYou({ code: 'X1', side: 'customer', status: 'closed', unread: 0 }, seenMap()));
  ok('…but a further change is news again', changedAgain === true);

  // ---------- the stored map cannot grow without bound ----------
  const bounded = await p.evaluate(() => {
    localStorage.setItem('repto_seen_v1', '{}');
    const map = {};
    for (let i = 0; i < 200; i++) map['K' + i] = 'closed';
    writeSeen(map);
    return Object.keys(JSON.parse(localStorage.getItem('repto_seen_v1'))).length;
  });
  ok('The seen map is capped', bounded === 80, bounded);

  // ---------- somebody who asked for less motion gets the colour, not the blink ----------
  const still = await ctx.newPage();
  await still.emulateMedia({ reducedMotion: 'reduce' });
  await still.goto('http://localhost:8831/');
  await still.waitForTimeout(800);
  const calm = await still.evaluate(() => {
    document.getElementById('myBookingsLink').hidden = false;
    paintChatBadge([{ code: 'A', side: 'worker', status: 'requested', unread: 0 }]);
    const probe = document.createElement('span');
    probe.style.color = 'var(--danger)';
    document.body.appendChild(probe);
    const danger = getComputedStyle(probe).color; probe.remove();
    const cs = getComputedStyle(document.getElementById('myBookingsDot'));
    return { animation: cs.animationName, colour: cs.backgroundColor, dangerRgb: danger };
  });
  ok('Reduced motion: no pulse', calm.animation === 'none', calm.animation);
  ok('Reduced motion: still --danger', calm.colour === calm.dangerRgb, calm.colour);

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');

  await browser.close(); srv.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall green');
  process.exit(failed ? 1 : 0);
})();
