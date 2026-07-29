/* Booking from a profile must mean that person.
   The bug this covers: tapping Book on worker A opened "Get a plumber now"
   and broadcast the job, so the customer thought they had booked the face
   they were looking at and got whoever answered first. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8823);
const ok = (label, cond, extra) => console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 26.1445, longitude: 91.7362 }, permissions: ['geolocation'],
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8823/');
  await page.waitForTimeout(900);

  // two plumbers, and the one we will tap is deliberately the further/worse one
  await page.evaluate(() => {
    const all = demoAll();
    const mk = (name, area, dLat, rs, rc) => ({
      id: 'p' + name.replace(/\s/g, ''), created_at: new Date().toISOString(),
      name, phone: '70865993' + (60 + rc), pin: '0000', city: 'Guwahati', area,
      lat: 26.1445 + dLat, lng: 91.7362, selfie: null, about: '',
      skills: [{ skill: 'Plumber', price: 400, unit: 'per visit', exp: '5 years' }],
      available: true, status: 'approved', verified: true, phone_verified: true,
      rating_sum: rs, rating_count: rc
    });
    all.unshift(mk('Chosen Plumber', 'Beltola', 0.05, 8, 2));   // far, poorly rated
    all.unshift(mk('Nearer Plumber', 'Beltola', 0.001, 50, 10)); // near, well rated
    demoSave(all);
  });

  const openChosen = async () => {
    await page.evaluate(() => go('hire'));
    await page.waitForTimeout(900);
    await page.fill('#hireSearch', 'Chosen Plumber');
    await page.waitForTimeout(600);
    await page.locator('.wcard').first().click();
    await page.waitForTimeout(500);
  };
  await openChosen();
  ok('Opened the chosen profile',
     (await page.locator('#wDetail h3').innerText()).includes('Chosen Plumber'));

  await page.locator('#bookCta').click();
  await page.waitForTimeout(500);

  const title = await page.locator('#nowTitle').innerText();
  ok('The sheet names the person, not the trade', /Chosen Plumber/.test(title), title);
  ok('It no longer says "Get a plumber now"', !/^Get a /.test(title), title);
  const explain = await page.locator('#nowExplain').innerText();
  ok('It promises the request goes to them alone', /and nobody else/i.test(explain),
     explain.split('\n')[0]);
  ok('Button says send, not find', (await page.locator('#nowGoBtn').innerText()).toLowerCase().includes('send'));

  await page.fill('#nowName', 'Test Customer');
  await page.fill('#nowPhone', '9876543210');
  await page.selectOption('#nowArea', 'Beltola');
  await page.locator('#nowGoBtn').click();
  await page.waitForTimeout(1200);

  // the offer must have gone to the chosen worker, not the nearer one
  const asked = await page.evaluate(() => {
    const j = JSON.parse(localStorage.getItem('nearse_jobs_v1') || '[]')[0];
    const names = (j.asked || []).map(id => (demoAll().find(w => w.id === id) || {}).name);
    return { names, direct: j.direct, requested: (demoAll().find(w => w.id === j.requested) || {}).name };
  });
  ok('Only the chosen worker was asked', asked.names.length === 1 && asked.names[0] === 'Chosen Plumber',
     asked.names.join(', '));
  ok('The job is marked as reserved for them', asked.direct === true);
  ok('…and remembers who was chosen', asked.requested === 'Chosen Plumber');

  const waiting = await page.locator('#searchBody').innerText();
  ok('The waiting screen names them', /Waiting for Chosen Plumber/.test(waiting), waiting.split('\n')[0]);

  // let the offer lapse
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('nearse_jobs_v1'));
    list[0].offer.expires = Date.now() - 1000;
    localStorage.setItem('nearse_jobs_v1', JSON.stringify(list));
  });
  await page.waitForTimeout(3500);

  const noAnswer = await page.locator('#searchBody').innerText();
  ok('It says who did not answer', /Chosen Plumber did not answer/.test(noAnswer), noAnswer.split('\n')[0]);
  ok('It states nobody else was told', /have not passed your request to anybody else/i.test(noAnswer));

  const stillOne = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('nearse_jobs_v1'))[0].asked || []).length);
  ok('The nearer plumber was NOT quietly given the job', stillOne === 1, stillOne + ' asked');

  // only now, and only because the customer said so
  await page.locator('#searchBody button', { hasText: 'Find someone else nearby' }).click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const j = JSON.parse(localStorage.getItem('nearse_jobs_v1'))[0];
    return { names: (j.asked || []).map(id => (demoAll().find(w => w.id === id) || {}).name), direct: j.direct };
  });
  ok('Widening reaches the next worker', after.names.includes('Nearer Plumber'), after.names.join(' → '));
  ok('…and the job is no longer reserved', after.direct === false);

  ok('No JS errors', errors.length === 0, errors.join(' | ') || 'none');
  await b.close(); srv.close();
})();
