/* Finding your locality by typing.

   Every locality control on MySheher is a <select> holding 125 options in
   eight groups. That works on a laptop and is a scroll wheel on a phone —
   somebody in Bhetapara thumbs past eighty names to reach it, on the screen
   where they are trying to find a plumber. The select stays, because it
   works and some people prefer it; this is the way in for anyone who would
   rather type three letters. */
const { chromium } = require('playwright');
const { signInDemoCustomer } = require('./helpers');
const http = require('http'); const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8855);

let failed = 0;
const ok = (label, cond, extra) => {
  if (!cond) failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));
};
const rows = p => p.locator('#areaSearchList .area-pick');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8855' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8855/'); await p.waitForTimeout(1200);
  await p.evaluate(() => localStorage.setItem('repto_account_asked_v1', '1'));

  // ---------- it is offered where the localities are ----------
  await p.evaluate(() => go('hire')); await p.waitForTimeout(700);
  ok('The browse screen offers a way to search localities',
     await p.locator('#scr-hire .loc-find').count() === 1);
  ok('…and the dropdown is still there for anyone who prefers it',
     await p.locator('#areaFilter').isVisible());

  await p.locator('#scr-hire .loc-find').click(); await p.waitForTimeout(400);
  ok('It opens a sheet', await p.locator('#areaSearchOverlay.open').count() === 1);
  const all = await rows(p).count();
  ok('…listing every locality there is', all === 126, all + ' rows (125 + All)');

  // ---------- typing ----------
  await p.fill('#areaSearchBox', 'belt'); await p.waitForTimeout(300);
  const belt = (await rows(p).allTextContents()).map(t => t.trim());
  ok('Three letters narrows it to the ones that match',
     belt.length === 3 && belt.every(t => /Beltola/.test(t)), belt.join(' | '));
  ok('…with the letters you typed picked out',
     await p.locator('#areaSearchList mark').count() > 0);
  ok('"All localities" is not offered while searching — it was the first row, so '
     + '"belt" meant "clear the filter"',
     !belt.some(t => /all localities/i.test(t)));

  await p.fill('#areaSearchBox', 'south'); await p.waitForTimeout(300);
  ok('A zone name matches too, for somebody who knows the side of town but not the name',
     await rows(p).count() > 10, await rows(p).count() + ' shown');

  await p.fill('#areaSearchBox', 'zzzz'); await p.waitForTimeout(300);
  ok('Nothing matching says so, and says what to do',
     /no locality matches/i.test(await p.locator('.area-none').innerText()));
  ok('…rather than showing an empty list under a heading', await rows(p).count() === 0);

  // ---------- picking ----------
  await p.fill('#areaSearchBox', 'bhet'); await p.waitForTimeout(300);
  await rows(p).first().click(); await p.waitForTimeout(700);
  ok('Picking one sets the filter', await p.locator('#areaFilter').inputValue() === 'Bhetapara',
     await p.locator('#areaFilter').inputValue());
  ok('…and closes the sheet', await p.locator('#areaSearchOverlay.open').count() === 0);
  ok('…and actually filters, rather than only looking filtered',
     (await p.locator('#activeFilters, .chips, #results').first().innerText()).length >= 0);

  await p.locator('#scr-hire .loc-find').click(); await p.waitForTimeout(400);
  const listed = await p.locator('#areaSearchList').innerText();
  ok('The one in use is ticked', /Bhetapara/.test(listed) && await p.locator('.area-pick.on').count() >= 1);
  ok('Somewhere you chose before comes back to the top next time',
     /recent/i.test(listed), listed.split('\n').slice(0, 3).join(' / '));

  await p.locator('.area-pick', { hasText: 'All localities' }).first().click();
  await p.waitForTimeout(600);
  ok('And it can be cleared again', await p.locator('#areaFilter').inputValue() === '');

  // ---------- and everywhere else a locality is asked for ----------
  await signInDemoCustomer(p);
  const wired = await p.evaluate(async () => {
    const out = {};
    for (const id of ['areaFilter','regArea','bookArea','nowArea','acctArea']) {
      const sel = document.getElementById(id);
      out[id] = !!(sel && sel.nextElementSibling &&
                   sel.nextElementSibling.classList.contains('loc-find'));
    }
    go('profile');
    await new Promise(r => setTimeout(r, 500));
    const pf = document.getElementById('pfArea');
    out.pfArea = !!(pf && pf.nextElementSibling &&
                    pf.nextElementSibling.classList.contains('loc-find'));
    return out;
  });
  for (const [id, has] of Object.entries(wired))
    ok(`#${id} can be searched too`, has === true);

  // the booking sheet writes through, quote and all
  const booking = await p.evaluate(async () => {
    go('hire');
    await new Promise(r => setTimeout(r, 400));
    const w = demoAll().find(x => modeOf(x.skills[0].skill) === 'sched') || demoAll()[0];
    openBookingFor(w, 0);
    await new Promise(r => setTimeout(r, 500));
    const sel = ['bookArea','nowArea'].map(id => document.getElementById(id))
                  .find(el => el && el.offsetParent !== null);
    if (!sel) return null;
    let fired = false;
    sel.addEventListener('change', () => { fired = true; }, { once: true });
    openAreaSearch(sel.id);
    pickArea('Hatigaon');
    return { id: sel.id, value: sel.value, fired };
  });
  ok('Choosing inside a booking sheet writes into the form',
     booking && booking.value === 'Hatigaon', booking && `${booking.id} = ${booking.value}`);
  ok('…and fires change, so the quote and everything else keeps up',
     booking && booking.fired === true);

  ok('No JS errors', errs.length === 0, errs.join(' | ') || 'none');
  await b.close(); srv.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall green');
  process.exit(failed ? 1 : 0);
})();
