/* Three things that only exist because somebody used the app and told us.

   A mechanic could accept three bookings for the same hour. A job accepted
   and forgotten went unmentioned for ever, because nothing had changed and
   the app only ever spoke when something did. And a review — the thing that
   decides whether a worker gets more work — happened entirely behind their
   back.

   The rules themselves live in the database, where a client cannot get round
   them, so they are asserted against the schema. What the browser drives is
   what a person actually sees. */
const { chromium } = require('playwright');
const { signInDemoCustomer } = require('./helpers');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const sql  = fs.readFileSync('/home/user/salinur/docs/supabase-workers-setup.sql', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8854);

let failed = 0;
const ok = (label, cond, extra) => {
  if (!cond) failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));
};

(async () => {
  // ---------- one place at a time ----------
  ok('The when is stored as data, not only as a sentence',
     /add column if not exists slot_date date/.test(sql) &&
     /add column if not exists slot_part text/.test(sql));
  ok('An instant job is exclusive whatever its date',
     /when coalesce\(p_mode,''\) = 'now'\s+then 'now'/.test(sql));
  ok('A monthly hire never clashes — four households is employment',
     /when coalesce\(p_mode,''\) = 'hire' then null/.test(sql));
  ok('A dated visit clashes on the same day and part of day',
     /p_date::text \|\| '#' \|\| coalesce\(nullif\(btrim\(p_part\),''\), 'any'\)/.test(sql));
  ok('Accepting a clashing job is refused',
     /You already have a job at that time/.test(sql));
  ok('…and the check locks the rows, so two taps in one second cannot both win',
     /for update;\s*\n\s*get diagnostics clashes = row_count/.test(sql));
  ok('The others are told, with what to do next',
     /Booked by someone else — please choose another time, or another worker/.test(sql));
  ok('The instant path is guarded too, where the report came from',
     /You are already on a job\. Finish that one first/.test(sql));
  ok('A request for a slot already gone is refused before it is sent',
     /raise exception 'BOOKED_ELSEWHERE'/.test(sql));

  // ---------- reminders ----------
  ok('A job accepted and not started is chased',
     /sweep_job_reminders/.test(sql) && /t\.status = 'accepted'/.test(sql));
  ok('…backing off rather than nagging: 30m, 2h, 6h, then daily',
     /when 0 then interval '30 minutes'/.test(sql) &&
     /when 1 then interval '2 hours'/.test(sql) &&
     /when 2 then interval '6 hours'/.test(sql) &&
     /else\s+interval '24 hours'/.test(sql));
  ok('…and giving up after six', /coalesce\(jr\.sent, 0\) < 6/.test(sql));
  ok('Starting or cancelling the job stops it dead',
     /new\.status <> 'accepted'/.test(sql) && /delete from job_reminders where thread_id = new\.id/.test(sql));
  ok('…and clears anything already queued',
     /delete from push_outbox\s*\n\s*where tag = 'remind-'/.test(sql));
  ok('It runs often enough for a 30-minute first nudge',
     /'mysheher-job-reminders', '\*\/10 \* \* \* \*'/.test(sql));

  // ---------- a review reaches the worker ----------
  ok('A review alerts the worker', /create trigger worker_ratings_push_trg/.test(sql));
  ok('…on a rewrite as well as a first one',
     /after insert or update of stars, comment on public\.worker_ratings/.test(sql));
  ok('…carrying what was actually written',
     /new\.stars \|\| '★ — "' \|\| left\(btrim\(new\.comment\), 90\)/.test(sql));

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8854' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8854/'); await p.waitForTimeout(1200);
  await p.evaluate(() => localStorage.setItem('repto_account_asked_v1', '1'));
  /* signed in, because otherwise "pick another time" correctly meets the
     account gate and the sheet under test never opens */
  await signInDemoCustomer(p);

  // ---------- the customer's side of a clash ----------
  const gone = await p.evaluate(async () => {
    const w = demoAll()[0];
    slotGoneFor(w, w.skills[0].skill);
    await new Promise(r => setTimeout(r, 250));
    return {
      open: document.getElementById('goneOverlay').classList.contains('open'),
      title: document.getElementById('goneTitle').textContent,
      sub: document.getElementById('goneSub').textContent,
      first: w.name.split(' ')[0]
    };
  });
  ok('A taken slot brings up an explanation, not a dead end', gone.open === true);
  ok('…naming the worker they had chosen',
     gone.title.includes(gone.first), gone.title);
  ok('…offering the same person at another time',
     /pick another time/i.test(gone.sub), gone.sub);
  ok('…and somebody else as the other way out',
     (await p.locator('#goneElseBtn').innerText()).toLowerCase().includes('who else'));

  ok('Picking another time reopens that worker rather than a blank search',
     await p.evaluate(async () => {
       document.getElementById('goneAgainBtn').click();
       await new Promise(r => setTimeout(r, 400));
       return !!currentWorker && [...document.querySelectorAll('.overlay.open')].length > 0;
     }));

  // ---------- the worker's side of a review ----------
  await p.evaluate(() => {
    [...document.querySelectorAll('.overlay.open')].forEach(o => o.classList.remove('open'));
    localStorage.removeItem('repto_reviews_seen_v1');
    const w = demoAll()[0];
    session = { phone: w.phone, pin: w.pin, name: w.name, registered: true, worker: w };
    saveSession();
  });

  const first = await p.evaluate(async () => {
    await maybeShowNewReview({ reviews: 4, avg_stars: '4.5' });
    await new Promise(r => setTimeout(r, 300));
    return document.getElementById('newReviewOverlay').classList.contains('open');
  });
  ok('An established worker signing in is not told about old reviews', first === false);

  const shown = await p.evaluate(async () => {
    const w = demoAll()[0];
    w.reviews = [{ code: 'X', stars: 5, comment: 'On time, tidy, price stayed as agreed.',
                   author: 'Priya', skill: w.skills[0].skill, created_at: new Date().toISOString() }];
    demoSave(demoAll().map(x => x.id === w.id ? w : x));
    await maybeShowNewReview({ reviews: 5, avg_stars: '4.6' });
    await new Promise(r => setTimeout(r, 500));
    return {
      open: document.getElementById('newReviewOverlay').classList.contains('open'),
      sub: document.getElementById('nrSub').textContent,
      body: document.getElementById('nrBody').innerText
    };
  });
  ok('A new review pops up', shown.open === true);
  ok('…and shows what they wrote, not just that it happened',
     /price stayed as agreed/.test(shown.body), shown.body.replace(/\n/g, ' ').slice(0, 60));
  ok('…with the stars', /★/.test(shown.body));
  ok('…and who left it', /Priya/.test(shown.body));

  ok('Nothing new means no pop-up', await p.evaluate(async () => {
    closeModal('newReviewOverlay');
    await new Promise(r => setTimeout(r, 300));
    await maybeShowNewReview({ reviews: 5, avg_stars: '4.6' });
    await new Promise(r => setTimeout(r, 300));
    return document.getElementById('newReviewOverlay').classList.contains('open');
  }) === false);

  ok('A rewrite counts as news too', await p.evaluate(async () => {
    await maybeShowNewReview({ reviews: 5, avg_stars: '3.9' });
    await new Promise(r => setTimeout(r, 400));
    const open = document.getElementById('newReviewOverlay').classList.contains('open');
    const sub = document.getElementById('nrSub').textContent;
    closeModal('newReviewOverlay');
    return open && /changed what they wrote/i.test(sub);
  }));

  ok('It never lands on top of something else', await p.evaluate(async () => {
    await new Promise(r => setTimeout(r, 350));
    openModal('goneOverlay');
    await maybeShowNewReview({ reviews: 9, avg_stars: '4.0' });
    await new Promise(r => setTimeout(r, 300));
    const over = document.getElementById('newReviewOverlay').classList.contains('open');
    closeModal('goneOverlay');
    return over === false;
  }));

  ok('No JS errors', errs.length === 0, errs.join(' | ') || 'none');
  await b.close(); srv.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall green');
  process.exit(failed ? 1 : 0);
})();
