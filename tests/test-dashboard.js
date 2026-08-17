/* The admin dashboard: tabs, the numbers it derives, and the activity list. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8817);
const ok = (label, cond, extra) => console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('nearse_preview_admin', '4242'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept('4242'));

  await page.goto('http://localhost:8817/');
  await page.waitForTimeout(900);

  // seed a day's worth of activity through the real API
  await page.evaluate(async () => {
    const workers = demoAll().filter(w => statusOf(w) === 'approved');
    for (let i = 0; i < 5; i++) {
      const w = workers[i % workers.length];
      await api.book({ worker_id: w.id, worker_name: w.name, customer_name: 'Cust ' + i,
                       customer_phone: '98765432' + (10 + i),
                       note: (i % 2 ? 'Plumber' : 'Electrician') + ' | Today · Morning | Beltola | note' });
    }
  });

  await page.goto('http://localhost:8817/#admin');
  await page.waitForTimeout(1600);
  ok('Admin opens', await page.locator('#scr-admin.on').count() === 1);
  /* Stats, Review, Activity, Alerts, Banner — Alerts arrived with push and
     Banner with the home-screen slots, and each time this line failed with
     the new name printed beside it, which is the whole reason it names the
     tabs instead of counting them. */
  const tabNames = () => page.locator('.admin-tabs .tab').allTextContents();
  ok('Five tabs, in order',
     (await tabNames()).join(' | ') === 'Stats | Review | Activity | Alerts | Banner',
     (await tabNames()).join(' | '));
  ok('Stats is the default tab', await page.locator('.admin-tabs .tab.on').innerText() === 'Stats');
  /* They must all fit on one line: pinned at three columns while five tabs
     existed, the last two wrapped underneath. */
  ok('…on a single row',
     await page.locator('.admin-tabs .tab').evaluateAll(
       els => new Set(els.map(e => Math.round(e.getBoundingClientRect().top))).size) === 1);

  /* And the row survives changing tab. paintReview carried its own copy of
     this markup, three tabs old, so an admin on Review — where they spend
     their time — could not see Alerts or Banner at all. */
  await page.evaluate(() => setAdminTab('review'));
  await page.waitForTimeout(1200);
  ok('The same five tabs are there from Review',
     (await tabNames()).join(' | ') === 'Stats | Review | Activity | Alerts | Banner',
     (await tabNames()).join(' | '));
  ok('…with Review marked as the one you are on',
     await page.locator('.admin-tabs .tab.on').innerText() === 'Review');
  await page.evaluate(() => setAdminTab('stats'));
  await page.waitForTimeout(1200);

  // headline tiles
  const tiles = await page.locator('.stat-grid').first().locator('.stat').evaluateAll(
    els => els.map(e => e.querySelector('b').textContent + ' ' + e.querySelector('span').textContent));
  ok('Four headline numbers', tiles.length === 4, tiles.join(' | '));
  ok('Requests today counted', tiles.some(t => t.startsWith('5 requests today')), tiles[1]);

  const table = await page.locator('.stat-table').first().innerText();
  // the header is uppercased by CSS, so innerText comes back shouting
  const flat = table.toLowerCase();
  ok('Table covers today / 7 / 30 / all time',
     ['today', '7d', '30d', 'all'].every(h => flat.includes(h)));
  ok('Registrations row present', table.includes('Worker registrations'));
  ok('Requests row present', table.includes('Requests sent'));
  ok('Completions row present', table.includes('Jobs completed'));
  ok('Ratings row present', table.includes('Ratings left'));

  ok('Says plainly what completion cannot measure',
     (await page.locator('.note-box').innerText()).includes('never learn what happened'));

  ok('14 day chart drawn', await page.locator('.bar-col').count() === 14);
  ok('Today\'s bar is not empty', await page.evaluate(() => {
    const last = document.querySelectorAll('.bar-col')[13];
    return parseFloat(last.querySelector('.b2').style.height) > 0;
  }));

  const leak = await page.locator('.panel-sub').first().innerText();
  ok('Supply leak panel present', leak.includes('nobody has ever booked'));
  ok('Top services ranked', await page.locator('.rank').count() > 0,
     (await page.locator('.rank').first().innerText()).replace(/\n/g, ' '));

  // activity tab
  await page.locator('.admin-tabs .tab', { hasText: 'Activity' }).click();
  await page.waitForTimeout(700);
  ok('Activity lists the requests', await page.locator('.stat-table.act tbody tr').count() === 5);
  const first = await page.locator('.stat-table.act tbody tr').first().innerText();
  ok('Activity row carries worker, service and customer',
     first.includes('WhatsApp') && /9876543/.test(first), first.replace(/\n/g, ' / '));

  // review tab still works
  await page.locator('.admin-tabs .tab', { hasText: 'Review' }).click();
  await page.waitForTimeout(900);
  ok('Review tab still shows the queue', (await page.locator('#adminPanel').innerText()).includes('Profile review'));

  // and back to the dashboard
  await page.locator('.admin-tabs .tab', { hasText: 'Stats' }).click();
  await page.waitForTimeout(700);
  ok('Returns to the dashboard', await page.locator('.stat-grid').count() > 0);

  ok('No horizontal overflow at 390px',
     await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  await page.screenshot({ path: '/tmp/claude-0/-home-user-salinur/5804f10d-9047-5141-886a-31b320556fa3/scratchpad/admin-dash.png', fullPage: true });
  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
