/* Seven things reported from a phone, not found by reading the code. Each one
   is driven here the way the person who reported it would hit it. */
const { chromium } = require('playwright');
const { signInDemoCustomer } = require('./helpers');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const sql  = fs.readFileSync('/home/user/salinur/docs/supabase-workers-setup.sql', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8852);

let failed = 0;
const ok = (label, cond, extra) => {
  if (!cond) failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));
};

(async () => {
  // ---------- 1. every booking mode wakes the worker ----------
  /* The trigger is what does this, so it is asserted against the schema: the
     scheduled and enquiry flows alerted because they insert a thread, and the
     other two inserted somewhere else entirely and alerted nobody. */
  ok('A new thread alerts the worker',
     /create trigger threads_push_trg after insert on public\.threads/.test(sql));
  ok('An instant offer alerts the worker — 60 seconds to answer it',
     /create trigger job_offers_push_trg\s+after insert on public\.job_offers/.test(sql));
  ok('An appointment alerts the worker',
     /create trigger appointments_push_trg\s+after insert on public\.appointments/.test(sql));
  ok('The instant alert says how long they have',
     /60 seconds to accept/.test(sql));
  ok('The appointment alert carries the day and the time',
     /booked ' \|\|[\s\S]{0,120}slot_time/.test(sql));

  // ---------- 2. the accept alert is held, so an undo can retract it ----------
  ok('An accepted booking is queued, not sent at once',
     /'thread-' \|\| new\.id::text, interval '6 seconds'/.test(sql));
  ok('…and a decline deletes it before it goes',
     /withdraw_push\('thread-' \|\| new\.id::text, '%accepted your booking'\)/.test(sql));
  ok('claim_push respects the hold', /o\.send_after <= now\(\)/.test(sql));
  ok('withdraw_push only ever deletes what has not been sent',
     /delete from push_outbox[\s\S]{0,120}sent_at is null/.test(sql));

  // ---------- 6. one trade per profile, in the database too ----------
  ok('The database refuses a second service',
     /A profile is for one service/.test(sql));

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8852' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8852/'); await p.waitForTimeout(1200);
  await p.evaluate(() => localStorage.setItem('repto_account_asked_v1', '1'));

  // ---------- 4. services sit in the category they belong to ----------
  const cats = await p.evaluate(() => {
    const out = {};
    CATALOGUE.forEach(([key, , items]) => items.forEach(([n]) => { out[n] = key; }));
    return out;
  });
  ok('A nutritionist is a health service, not a beauty one',
     cats['Dietician & Nutritionist'] === 'health', cats['Dietician & Nutritionist']);
  ok('A physiotherapist is too — it is a registered profession',
     cats['Physiotherapist (Home Visit)'] === 'health', cats['Physiotherapist (Home Visit)']);
  ok('An online tutor is a tutor, not a tech service',
     cats['Online Tutor (Any Subject)'] === 'tutor', cats['Online Tutor (Any Subject)']);
  ok('…and being a tutor, it is hired by the month rather than as a one-off job',
     await p.evaluate(() => modeOf('Online Tutor (Any Subject)')) === 'hire');
  ok('No service appears in two categories at once', await p.evaluate(() => {
    const seen = {}; let dup = 0;
    CATALOGUE.forEach(([k, , items]) => items.forEach(([n]) => { if (seen[n]) dup++; seen[n] = k; }));
    return dup;
  }) === 0);
  ok('Every service still has a booking mode',
     await p.evaluate(() => SKILLS.filter(s => !modeOf(s.n)).length) === 0);
  ok('Every service still has a price band',
     await p.evaluate(() => SKILLS.filter(s => !RATE_BAND[s.n]).length) === 0);

  // ---------- 6. one skill in the picker ----------
  await p.evaluate(() => { go('work'); authTab('up'); }); await p.waitForTimeout(600);
  ok('The label asks for one service',
     (await p.locator('label[for], .sublabel').filter({ hasText: 'choose one' }).count()) > 0);
  const picking = await p.evaluate(async () => {
    picked = [];
    toggleSkill('Carpenter');
    const one = [...picked];
    toggleSkill('Plumber');            // a second choice replaces the first
    const two = [...picked];
    toggleSkill('Plumber');            // tapping it again clears it
    return { one, two, off: [...picked] };
  });
  ok('Choosing a service selects it', JSON.stringify(picking.one) === '["Carpenter"]', picking.one.join(','));
  ok('Choosing another replaces it rather than adding',
     JSON.stringify(picking.two) === '["Plumber"]', picking.two.join(','));
  ok('…and tapping the chosen one clears it', picking.off.length === 0);
  ok('Nothing is greyed out — a disabled row with no reason reads as a bug',
     await p.evaluate(() => { picked = ['Carpenter']; openCat('repair');
       return document.querySelectorAll('#skillPicker .svc-row[disabled]').length; }) === 0);

  // ---------- 5. the back camera ----------
  ok('The camera sheet offers the back camera', await p.locator('#camFlip').count() === 1);
  ok('The front camera is still the default',
     await p.evaluate(() => camFacing) === 'user');
  ok('Flipping swaps which lens is asked for and relabels the button',
     await p.evaluate(async () => {
       camFacing = 'user';
       /* a real MediaStream: assigning anything else to srcObject throws,
          which is the mock failing, not the app */
       navigator.mediaDevices.getUserMedia = async () => new MediaStream();
       navigator.mediaDevices.enumerateDevices = async () =>
         [{ kind: 'videoinput' }, { kind: 'videoinput' }];
       document.getElementById('camVideo').play = async () => {};
       await flipCamera();
       return camFacing === 'environment' &&
              document.getElementById('camFlip').textContent === 'Use the front camera';
     }));
  ok('A selfie is mirrored on screen; the back camera is not',
     await p.evaluate(() => !document.getElementById('camVideo').classList.contains('mirrored')));
  ok('…and only a mirrored frame is un-mirrored when captured',
     /if\(camFacing === "user"\)\{ ctx\.translate/.test(html));

  // ---------- 7. a booked slot says so ----------
  await p.evaluate(() => { camFacing = 'user'; go('home'); }); await p.waitForTimeout(300);
  await signInDemoCustomer(p);
  const grid = await p.evaluate(async () => {
    const w = demoAll().find(x => (x.skills || []).some(s => modeOf(s.skill) === 'slot'))
           || demoAll()[0];
    w.skills = [{ skill: 'Dentist', price: 500, unit: 'per session' }];
    w.availability = { days: [0,1,2,3,4,5,6], from: '10:00', to: '13:00', len: 30 };
    currentWorker = w; bookPick = { svc: 0 };
    slotPick = { date: null, time: null, taken: [] };
    const d = new Date(); d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    slotPick.date = iso;
    slotPick.taken = ['11:00'];
    renderSlotTimes();
    const cells = [...document.querySelectorAll('#slotTimeGrid .tslot')];
    const probe = document.createElement('span');
    probe.style.color = 'var(--danger)';
    document.body.appendChild(probe);
    const danger = getComputedStyle(probe).color; probe.remove();
    const booked = document.querySelector('.tslot.taken');
    return {
      total: cells.length,
      bookable: document.querySelectorAll('#slotTimeGrid button.tslot').length,
      label: booked && booked.querySelector('.tslot-tag').textContent,
      when: booked && booked.querySelector('.tslot-when').textContent,
      red: booked && getComputedStyle(booked).color === danger,
      clickable: booked && booked.tagName === 'BUTTON'
    };
  });
  ok('A taken hour is still on the grid', grid.total === 6, grid.total + ' cells');
  ok('…but it cannot be booked', grid.bookable === 5, grid.bookable + ' bookable');
  ok('…it is the right hour', grid.when === '11:00', grid.when);
  ok('…it says Booked', /booked/i.test(grid.label || ''), grid.label);
  ok('…in red', grid.red === true);
  ok('…and it is not a button', grid.clickable === false);

  // ---------- 2 + 3. the undo, and what the customer is offered ----------
  ok('There is an undo bar', await p.locator('#undoBar').count() === 1);
  ok('It is out of the way until it is needed', await p.locator('#undoBar').isHidden());

  const undo = await p.evaluate(async () => {
    let undone = null;
    offerUndo('Accepted — you have a few seconds to change your mind', async () => { undone = 'ran'; });
    const shown = !document.getElementById('undoBar').hidden;
    const text  = document.getElementById('undoText').textContent;
    await runUndo();
    return { shown, text, undone, hiddenAfter: document.getElementById('undoBar').hidden };
  });
  ok('Accepting offers an undo', undo.shown === true);
  ok('…and says so plainly', /change your mind/.test(undo.text), undo.text);
  ok('Tapping it runs the reversal', undo.undone === 'ran');
  ok('…and the bar goes', undo.hiddenAfter === true);

  ok('It gives up after five seconds, not sooner or never',
     await p.evaluate(() => UNDO_MS) === 5000);
  ok('Letting it lapse leaves the acceptance standing', await p.evaluate(async () => {
    let ran = false;
    offerUndo('x', async () => { ran = true; });
    await new Promise(r => setTimeout(r, 5400));
    await runUndo();                       // too late — nothing should happen
    return !ran && document.getElementById('undoBar').hidden;
  }));

  ok('The reason the customer is given names the problem, not the mistake',
     await p.evaluate(() => UNAVAILABLE) === 'Sorry, the worker is unavailable at the moment.');

  // and the alternatives that follow it
  const alts = await p.evaluate(async () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="altWrap"></div>');
    /* a trade two people actually offer — otherwise the honest answer is
       "nobody else is listed", which is the next assertion's job */
    const all = demoAll();
    const w = all[0];
    const skill = w.skills[0].skill;
    all[1].skills = [{ skill, price: 500, unit: w.skills[0].unit }];
    demoSave(all);
    await suggestOthers({ skill, worker_id: w.id });
    await new Promise(r => setTimeout(r, 600));
    const rows = [...document.querySelectorAll('#altWrap .alt-row')];
    return {
      n: rows.length,
      head: (document.querySelector('.alt-head') || {}).textContent || '',
      includesTheOneWhoSaidNo: rows.some(r => r.innerText.includes(w.name)),
      hasBook: rows.every(r => r.innerText.includes('Book'))
    };
  });
  ok('Somebody else who does the same work is offered', alts.n > 0, alts.n + ' shown');
  ok('…named by the trade', /others who do/i.test(alts.head), alts.head);
  ok('…never the worker who just said no', alts.includesTheOneWhoSaidNo === false);
  ok('…and each one is bookable from there', alts.hasBook === true);

  /* And when there genuinely is nobody, say that rather than showing an
     empty box under a heading promising alternatives. */
  const none = await p.evaluate(async () => {
    document.getElementById('altWrap').innerHTML = '';
    await suggestOthers({ skill: 'Drone Operator', worker_id: 'nobody' });
    await new Promise(r => setTimeout(r, 600));
    return document.getElementById('altWrap').innerText;
  });
  ok('With nobody else listed, it says so', /nobody else is listed/i.test(none), none.slice(0, 60));

  ok('No JS errors', errs.length === 0, errs.join(' | ') || 'none');
  await b.close(); srv.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall green');
  process.exit(failed ? 1 : 0);
})();
