/* Selling an audience.

   A shop owner wanting a new tiffin service known does not need a plumber,
   they need somebody twenty thousand people in Guwahati already follow. That
   is a service, and it belongs here with a rate next to it.

   It brings one problem no other trade has. A carpenter's claim about
   themselves is checked by the work. An influencer's central claim IS a
   number, and a self-reported follower count is worth nothing — putting an
   unverified "50K" on a profile is exactly the credibility problem this app
   is trying not to have.

   So: declared at sign-up, which is what the 10,000 bar is measured against
   and what puts somebody in the queue; shown to a customer only after a
   person here has opened the account and looked. What this file guards is
   that the second half cannot be skipped, that the bar is the largest single
   account rather than five small ones added up, and that the platform comes
   from the URL rather than from whatever was typed. */
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
}).listen(8873);

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

async function ready(page, phone, trade, url, followers) {
  await page.evaluate(p => {
    session = { phone: p, pin: '1234', name: 'Borsha Creates', registered: false };
    saveSession(); go('register'); initRegister();
  }, phone);
  await page.waitForTimeout(500);
  await page.evaluate(([t, u, n]) => {
    picked = [t];
    if (typeof renderPicked === 'function') renderPicked();
    if (typeof renderModeBlocks === 'function') renderModeBlocks();
    document.querySelectorAll('.picked-card .sd-price').forEach(i => { i.value = '4000'; });
    selfieData = 'data:image/webp;base64,AAAA'; thumbData = selfieData;
    const a = document.getElementById('regArea'); if (a) a.value = 'Beltola';
    const ru = document.getElementById('regReachUrl'); if (ru) ru.value = u;
    const rn = document.getElementById('regReachN');   if (rn) rn.value = n;
    document.getElementById('consentPublish').checked = true;
    document.getElementById('consentAge').checked = true;
    window._pricesConfirmed = true;
  }, [trade, url, followers]);
  await page.waitForTimeout(200);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8873/'); await page.waitForTimeout(1800);
  await page.evaluate(() => { maybeAskNotify = () => {}; maybeOfferAccount = () => {}; });

  // ---------- the trades exist, and are priced ----------
  const cat = await page.evaluate(() => {
    const g = CATALOGUE.find(x => x[0] === 'reach');
    if (!g) return null;
    return { label: g[1], skills: g[2].map(s => s[0]),
             units: [...new Set(g[2].map(s => s[1]))],
             unpriced: g[2].filter(s => !RATE_BAND[s[0]]).map(s => s[0]) };
  });
  ok('There is an influencer category', !!cat, cat && cat.label);
  ok('…with the trades a business would actually buy',
     cat.skills.includes('Instagram Influencer') && cat.skills.includes('YouTube Creator'),
     cat.skills.join(', '));
  ok('…every one of them priced', cat.unpriced.length === 0, cat.unpriced.join(', '));

  // ---------- the extra question appears only for those trades ----------
  await ready(page, '9876500071', 'Plumber', '', '');
  ok('A plumber is not asked for followers',
     await page.evaluate(() => document.getElementById('regReachBlock').hidden) === true);
  await ready(page, '9876500071', 'Instagram Influencer', '', '');
  const blk = await page.evaluate(() => {
    const el = document.getElementById('regReachBlock');
    return { hidden: el.hidden, says: el.innerText.replace(/\s+/g, ' ') };
  });
  ok('An influencer is', blk.hidden === false);
  ok('…and is told the number will be checked, before typing it',
     /check/i.test(blk.says) && /before your profile goes live/i.test(blk.says));
  ok('…and told the bar is one account, not five added up',
     /10,000 on one account/i.test(blk.says), blk.says.slice(0, 120));

  // ---------- the bar ----------
  await ready(page, '9876500072', 'Instagram Influencer', 'https://instagram.com/borsha', '4000');
  await page.evaluate(() => { regGo(4); saveProfile(); });
  await page.waitForTimeout(1200);
  ok('Four thousand followers does not get published',
     await page.evaluate(() => currentScreen) !== 'done',
     await page.evaluate(() => currentScreen));
  ok('…and nothing was written',
     await page.evaluate(() => !demoAll().find(w => w.phone === '9876500072')));

  await ready(page, '9876500073', 'Instagram Influencer', 'https://example.com/borsha', '40000');
  await page.evaluate(() => { regGo(4); saveProfile(); });
  await page.waitForTimeout(1200);
  ok('A link nobody can count followers on is refused',
     await page.evaluate(() => !demoAll().find(w => w.phone === '9876500073')));

  // ---------- the good path ----------
  await page.evaluate(() => { session = null; saveSession(); });
  await ready(page, '9876500074', 'Instagram Influencer', 'https://www.instagram.com/borsha', '24000');
  await page.evaluate(() => { regGo(4); saveProfile(); });
  await page.waitForTimeout(1800);
  const rec = await page.evaluate(() => (demoAll().find(w => w.phone === '9876500074') || {}));
  ok('Twenty-four thousand gets through', !!rec.id);
  ok('…the account is stored', (rec.reach || []).length === 1, JSON.stringify(rec.reach));
  ok('…labelled from the URL, not from anything typed',
     (rec.reach || [])[0] && rec.reach[0].platform === 'Instagram',
     (rec.reach || [])[0] && rec.reach[0].platform);
  ok('…and nobody has checked it yet', !rec.reach_checked_at);

  // ---------- unchecked numbers are not shown to a customer ----------
  const id = await page.evaluate(() => {
    const all = demoAll();
    const i = all.findIndex(w => w.phone === '9876500074');
    all[i].status = 'approved'; all[i].available = true; demoSave(all);
    return all[i].id;
  });
  const openSheet = async () => {
    await page.evaluate(i => { workers = demoAll().filter(w => w.id === i); openWorker(i); }, id);
    await page.waitForTimeout(900);
    return page.evaluate(() => ({
      pills: document.querySelectorAll('#wOverlay .reach-pill').length,
      text: (document.getElementById('wReach') || {}).innerText || '',
      rels: [...document.querySelectorAll('#wOverlay .reach-pill')].map(a => a.getAttribute('rel') || '')
    }));
  };
  let sheet = await openSheet();
  ok('An unchecked follower count is shown to nobody', sheet.pills === 0, sheet.pills);
  await page.evaluate(() => closeModal('wOverlay'));

  // ---------- once a person has looked, it shows ----------
  await page.evaluate(i => {
    const all = demoAll();
    const w = all.find(x => x.id === i);
    w.reach_checked_at = new Date().toISOString();
    demoSave(all);
  }, id);
  sheet = await openSheet();
  ok('Once checked, the number is on the profile', sheet.pills === 1, sheet.pills);
  ok('…written the way an audience is said, not as a bank balance',
     /24K/.test(sheet.text), sheet.text.replace(/\s+/g, ' '));
  ok('…and said out loud that MySheher counted it',
     /Counted by MySheher/i.test(sheet.text));
  ok('…with the same rel as any other link out',
     sheet.rels.length === 1 && /nofollow/.test(sheet.rels[0]) && /noopener/.test(sheet.rels[0]),
     sheet.rels.join(' | '));
  await page.evaluate(() => closeModal('wOverlay'));

  // ---------- changing the number takes the check away ----------
  await page.evaluate(() => {
    session = { phone: '9876500074', pin: '1234', registered: true,
                worker: demoAll().find(w => w.phone === '9876500074') };
    saveSession();
  });
  await page.evaluate(async () => { await api.setWorkerReach(
    [{platform:'Instagram', url:'https://www.instagram.com/borsha', followers: 90000}]); });
  await page.waitForTimeout(400);
  ok('Editing the number takes the human check off it',
     await page.evaluate(() => !(demoAll().find(w => w.phone === '9876500074') || {}).reach_checked_at));

  // ---------- how the number reads ----------
  const fmt = await page.evaluate(() => [900, 2400, 24000, 150000, 12000000].map(compactCount));
  ok('Counts read the way they would be said here',
     fmt.join(' ') === '900 2.4K 24K 1.5 L 1.2 Cr', fmt.join(' '));

  ok('No page errors', errors.length === 0, errors.join(' | '));
  await b.close(); srv.close();
})();
