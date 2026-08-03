/* Who may rate a worker, and whether they are ever actually asked.

   Two separate things, and both matter. The first is a safety property: a
   worker's livelihood hangs off their rating, so somebody with a grudge and
   no booking must not be able to touch it. The second is why good workers
   look unrated — the app knew how to take a review and never asked for one
   unless the customer happened to be looking at the conversation at the
   right second.

   The permission itself is enforced in the database, so it is asserted here
   against the schema text rather than mimed in preview mode: the preview
   store has no tokens and proving anything against it would prove nothing. */
const { chromium } = require('playwright');
const { signInDemoCustomer } = require('./helpers');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const sql  = fs.readFileSync('/home/user/salinur/docs/supabase-workers-setup.sql', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8849);

let failed = 0;
const ok = (label, cond, extra) => {
  if (!cond) failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));
};

(async () => {
  // ---------- the rule itself, where it is actually enforced ----------
  const fn = sql.slice(sql.indexOf('create or replace function public.review_thread'));
  const body = fn.slice(0, fn.indexOf('\n$$;'));

  ok('review_thread is matched on the customer token, not just the code',
     /customer_token\s*=\s*p_token/.test(body));
  ok('…and refuses unless the work is finished',
     /st not in \('done','closed'\)/.test(body));
  ok('…and a booking that is not yours is simply not found',
     /Conversation not found/.test(body));
  ok('A second review edits the first rather than counting twice',
     /prev is null/.test(body) && /rating_count = rating_count \+ 1/.test(body) &&
     /rating_sum = rating_sum - prev \+ p_stars/.test(body));

  /* The punctuality question is a rating too, and a worker marking their own
     job on time would be worth more than a star. */
  const punct = sql.slice(sql.lastIndexOf('function public.rate_punctuality'));
  ok('The on-time question also needs the customer token',
     /p_token/.test(punct.slice(0, punct.indexOf('\n$$;'))));

  // ---------- and now the asking ----------
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8849' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8849/'); await p.waitForTimeout(1200);
  await signInDemoCustomer(p);

  /* A finished job the customer has not rated: exactly the state somebody is
     in after the worker has packed up and left the house. */
  const seed = async (status = 'done') => p.evaluate(async status => {
    /* Start from nothing each time. Leaving an earlier unrated job behind
       means the next assertion is answered by that one instead, and the
       test reads as a bug in code that is behaving correctly. */
    localStorage.removeItem('repto_review_asked_v1');
    localStorage.removeItem('repto_threads_store_v1');
    localStorage.removeItem('repto_my_bookings_v1');
    const w = demoAll()[0];
    const s = w.skills[0];
    const r = await api.startThread({ workerId: w.id, skill: s.skill, name: 'Priya Das',
      phone: '9876543210', area: 'Six Mile', detail: 'Today · Morning', note: '',
      price: s.price, unit: s.unit, mode: 'sched' });
    rememberBooking({ code: r.code, token: r.token, worker: w.name, skill: s.skill,
                      at: new Date().toISOString() });
    const all = JSON.parse(localStorage.getItem('repto_threads_store_v1'));
    const t = all.find(x => x.code === r.code);
    t.status = status;
    localStorage.setItem('repto_threads_store_v1', JSON.stringify(all));
    return { code: r.code, worker: w.name };
  }, status);

  const job = await seed('done');
  await p.evaluate(() => { reviewAskedThisSession = false; return refreshChatBadge(); });
  await p.waitForTimeout(900);

  ok('A finished job brings up the question by itself',
     await p.locator('#reviewOverlay.open').count() === 1);
  ok('…and it names the worker',
     (await p.locator('#reviewTitle').innerText()).includes(job.worker.split(' ')[0]),
     await p.locator('#reviewTitle').innerText());
  ok('…and offers a way out', await p.locator('#reviewLaterBtn').isVisible());

  // ---------- "Not now" is respected, three times, then it stops ----------
  await p.locator('#reviewLaterBtn').click(); await p.waitForTimeout(300);
  ok('Not now closes it', await p.locator('#reviewOverlay.open').count() === 0);
  ok('…and it does not ask twice in one sitting', await p.evaluate(async () => {
    await refreshChatBadge();
    return document.getElementById('reviewOverlay').classList.contains('open');
  }) === false);

  const asks = await p.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 4; i++) {
      reviewAskedThisSession = false;
      await refreshChatBadge();
      await new Promise(r => setTimeout(r, 250));
      const open = document.getElementById('reviewOverlay').classList.contains('open');
      out.push(open);
      /* close it and let the class actually come off before asking again —
         maybeAskForReview refuses to open over an overlay that is still up,
         which would read as "it stopped asking" when it did no such thing */
      if (open) { reviewLater(); await new Promise(r => setTimeout(r, 250)); }
    }
    return out;
  });
  ok('It asks three times in all, then leaves them alone',
     JSON.stringify(asks) === JSON.stringify([true, true, false, false]), asks.join(', '));

  ok('The conversation still offers a review afterwards', await p.evaluate(code => {
    const t = JSON.parse(localStorage.getItem('repto_threads_store_v1')).find(x => x.code === code);
    return t.status === 'done' && !t.reviewed;
  }, job.code));

  // ---------- rating it ----------
  const job2 = await seed('done');
  await p.evaluate(() => { reviewAskedThisSession = false; return refreshChatBadge(); });
  await p.waitForTimeout(900);
  ok('A new finished job is asked about', await p.locator('#reviewOverlay.open').count() === 1);

  await p.locator('#reviewSendBtn').click(); await p.waitForTimeout(400);
  ok('Posting with no stars is refused', await p.locator('#reviewOverlay.open').count() === 1);

  const before = await p.evaluate(() => {
    const w = demoAll()[0]; return { sum: w.rating_sum, count: w.rating_count };
  });
  await p.locator('#reviewStars span[data-s="4"]').click();
  await p.fill('#reviewText', 'On time, tidy work, price stayed as agreed.');
  await p.locator('#reviewSendBtn').click(); await p.waitForTimeout(900);

  ok('The review posts', await p.locator('#reviewOverlay.open').count() === 0);
  const after = await p.evaluate(code => {
    const w = demoAll()[0];
    const t = JSON.parse(localStorage.getItem('repto_threads_store_v1')).find(x => x.code === code);
    return { sum: w.rating_sum, count: w.rating_count, status: t.status, reviewed: t.reviewed,
             words: (w.reviews || [])[0] };
  }, job2.code);

  ok('…the rating moves',        after.sum === before.sum + 4 && after.count === before.count + 1,
     `${before.sum}/${before.count} → ${after.sum}/${after.count}`);
  ok('…the words are kept',      /price stayed as agreed/.test(after.words.comment || ''));
  ok('…shown under a first name only', after.words.author === 'Priya',
     after.words.author);
  ok('Rating a job also confirms it happened', after.status === 'closed', after.status);
  ok('…and it is not asked about again', await p.evaluate(async () => {
    reviewAskedThisSession = false;
    await refreshChatBadge();
    await new Promise(r => setTimeout(r, 250));
    return document.getElementById('reviewOverlay').classList.contains('open');
  }) === false);

  // ---------- an unfinished job is nobody's business yet ----------
  const job3 = await seed('accepted');
  const askedEarly = await p.evaluate(async () => {
    reviewAskedThisSession = false;
    await refreshChatBadge();
    await new Promise(r => setTimeout(r, 250));
    return document.getElementById('reviewOverlay').classList.contains('open');
  });
  ok('A job still in progress is not asked about', askedEarly === false);
  ok('…and the database would refuse it anyway', await p.evaluate(async code => {
    try { await api.reviewThread(code, 'whatever', 5, ''); return false; }
    catch (e) { return /finished/.test(e.message); }
  }, job3.code));

  // ---------- it does not barge in ----------
  await p.evaluate(() => { localStorage.removeItem('repto_review_asked_v1');
                           const all = JSON.parse(localStorage.getItem('repto_threads_store_v1'));
                           all.forEach(t => { if (!t.reviewed) t.status = 'done'; });
                           localStorage.setItem('repto_threads_store_v1', JSON.stringify(all)); });
  const polite = await p.evaluate(async () => {
    reviewAskedThisSession = false;
    openMenu();
    await refreshChatBadge();
    await new Promise(r => setTimeout(r, 250));
    const overMenu = document.getElementById('reviewOverlay').classList.contains('open');
    setMenu(false);
    return overMenu;
  });
  ok('It does not open over the menu', polite === false);

  ok('No JS errors', errs.length === 0, errs.join(' | ') || 'none');
  await b.close(); srv.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall green');
  process.exit(failed ? 1 : 0);
})();
