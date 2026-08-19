const { chromium } = require('playwright');
const { signInDemoCustomer } = require('./helpers');
const http = require('http');
const fs = require('fs');

const html = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const srv = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}).listen(8777);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 26.1445, longitude: 91.7362 },
    permissions: ['geolocation'],
  });
  // the app no longer ships an admin PIN; preview mode mints one per browser
  await ctx.addInitScript(() => { localStorage.setItem('nearse_preview_admin', '4242'); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:8777/');
  await page.waitForTimeout(700);
  await signInDemoCustomer(page);

  /* ---- landing ----
     Two illustrated doors — Hire somebody / Work with us — were the whole
     landing screen when this was written. It is a grid of the twelve most
     booked trades now, with See all services under it and the worker door
     moved to the raised tab in the bar, so the illustrations, their
     animations and .cta itself no longer exist. */
  console.log('Trade tiles on the landing screen:', await page.locator('.qtile').count());
  console.log('Tile order:', (await page.locator('.qt-label').allTextContents()).slice(0, 4).join(' | '));
  console.log('Every tile draws something:',
              await page.locator('.qtile .qt-pic svg').count() === await page.locator('.qtile').count());
  console.log('See all services is there:', await page.locator('.see-all').count() === 1);
  console.log('The worker door is the raised tab:',
              (await page.locator('#tabFab').innerText()).replace(/\s+/g, ' ').trim());
  console.log('Tiles are real buttons:', await page.evaluate(() => document.querySelector('.qtile').tagName));
  console.log('Budget Cars strip gone:', await page.locator('#carsNote').count() === 0);
  console.log('Dark theme:', await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
  console.log('Catalogue size:', await page.evaluate(() => SKILLS.length), 'services in',
              await page.evaluate(() => CATALOGUE.length), 'categories');
  console.log('No emoji in landing copy:', !/[\u{1F300}-\u{1FAFF}]/u.test(await page.locator('#scr-home').innerText()));
  await page.screenshot({ path: 'ks-landing.png' });

  // ---- worker side: banner + auth ----
  await page.locator('#tabFab').click();
  await page.waitForTimeout(400);
  console.log('Banner text:', (await page.locator('.banner h1').textContent()).trim());
  console.log('Sign in tab default:', await page.locator('#tabIn.on').count() === 1);
  await page.screenshot({ path: 'ks-work-banner.png' });

  await page.locator('#tabUp').click();
  console.log('Phone field is labelled WhatsApp:', (await page.locator('label[for="upPhone"]').textContent()).trim());
  console.log('Country code shown:', (await page.locator('#authUp .phone-input .cc').textContent()).trim());
  console.log('Email is optional:', (await page.locator('label[for="upEmail"]').textContent()).includes('optional'));

  // a number that cannot be an Indian mobile must be refused
  await page.fill('#upName', 'Salinur Alom');
  await page.fill('#upPhone', '1234567890');
  await page.fill('#upPin', '4321');
  await page.locator('#signUpBtn').click();
  await page.waitForTimeout(400);
  console.log('Rejects impossible mobile number:', await page.locator('#scr-work.on').count() === 1);

  await page.fill('#upPhone', '9435012345');
  await page.fill('#upEmail', 'not-an-email');
  await page.locator('#signUpBtn').click();
  await page.waitForTimeout(400);
  console.log('Rejects malformed email:', await page.locator('#scr-work.on').count() === 1);
  await page.fill('#upEmail', 'salinur@example.com');

  await page.locator('#signUpBtn').click();
  await page.waitForTimeout(800);

  // ---- WhatsApp click-to-chat verification ----
  console.log('Verify screen shown:', await page.locator('#scr-otp.on').count() === 1);
  console.log('WhatsApp flow is the default:', await page.locator('#waFlow').isVisible(),
              '| code-entry hidden:', !(await page.locator('#codeFlow').isVisible()));
  console.log('Prompt:', (await page.locator('#otpSent').innerText()).trim());
  const waCode = (await page.locator('#waCode').textContent()).trim();
  console.log('Code is 6 digits:', /^\d{6}$/.test(waCode));
  const waHref = await page.locator('#waSendBtn').getAttribute('href');
  console.log('Link targets the new Nearse number:', waHref.startsWith('https://wa.me/917086599367?text='));
  const waMsg = decodeURIComponent(waHref.split('?text=')[1]);
  console.log('Prefilled message:', JSON.stringify(waMsg));
  console.log('Message carries name, number and code:',
              waMsg.includes('Salinur Alom') && waMsg.includes('9435012345') && waMsg.includes(waCode));
  console.log('"I have sent it" is blocked until WhatsApp opens:', await page.locator('#waDoneBtn').isDisabled());
  await page.evaluate(() => markWaOpened());
  await page.waitForTimeout(200);
  console.log('Enabled after opening WhatsApp:', !(await page.locator('#waDoneBtn').isDisabled()));
  await page.locator('#waDoneBtn').click();
  await page.waitForTimeout(700);
  console.log('Profile setup shown:', await page.locator('#scr-register.on').count() === 1);

  // skill search + pick 3, 4th blocked
  console.log('Step 1 shows categories:', await page.locator('.cat-tile').count());
  await page.fill('#skillSearch', 'electric');
  await page.waitForTimeout(300);
  console.log('Search "electric" matches:', await page.locator('.svc-row').count());
  await page.locator('.svc-row', { hasText: 'Electrician' }).first().click();
  await page.waitForTimeout(250);
  console.log('Default unit for Electrician:', await page.locator('.picked-card .sd-unit').first().inputValue());
  await page.fill('#skillSearch', '');
  await page.waitForTimeout(300);
  await page.locator('.cat-tile', { hasText: 'Construction & Interiors' }).click();
  await page.waitForTimeout(300);
  console.log('Category opens its services:', await page.locator('.svc-row').count());
  await page.locator('.svc-row', { hasText: 'Carpenter' }).first().click();
  await page.waitForTimeout(250);
  await page.locator('.step-back').click();
  await page.waitForTimeout(250);
  await page.locator('.cat-tile', { hasText: 'Repairs & Appliances' }).click();
  await page.waitForTimeout(250);
  await page.locator('.svc-row', { hasText: 'Plumber' }).first().click();
  await page.waitForTimeout(250);
  // A profile is one trade now. Choosing Plumber above replaced Carpenter
  // rather than adding to it, so there is exactly one card here.
  console.log('One service at a time:', await page.locator('.picked-card').count() === 1);
  console.log('Counter reads:', (await page.locator('#skillCount').textContent()).trim());
  console.log('Nothing is greyed out:', await page.locator('.svc-row[disabled]').count() === 0);

  // put Carpenter back — the rate assertions below are about a carpenter
  await page.locator('.step-back').click();
  await page.waitForTimeout(250);
  await page.locator('.cat-tile', { hasText: 'Construction & Interiors' }).click();
  await page.waitForTimeout(250);
  await page.locator('.svc-row', { hasText: 'Carpenter' }).first().click();
  await page.waitForTimeout(300);

  console.log('Rate band shown:', (await page.locator('.picked-card .band').first().innerText()).trim());
  const cards = page.locator('.picked-card');
  await cards.nth(0).locator('.sd-price').fill('900');
  await cards.nth(0).locator('.sd-exp').fill('6 years');
  // price validation
  await cards.nth(0).locator('.sd-price').fill('');
  await page.locator('#stepNext').click();
  await page.waitForTimeout(300);
  console.log('Blocks empty rate:', await page.evaluate(() => regStep) === 1);

  // a carpenter at Rs 9,000/day is nonsense and must be refused
  const carp = page.locator('.picked-card', { hasText: 'Carpenter' });
  await carp.locator('.sd-price').fill('9000');
  await page.waitForTimeout(250);
  console.log('Over-ceiling flagged live:', (await carp.locator('.band').innerText()).includes('Too high'));
  // and it must not merely warn — the step has to refuse to advance while the
  // rate is above the ceiling. (This used to be checked with a second card
  // still holding a bad rate; there is only one card now.)
  await page.locator('#stepNext').click();
  await page.waitForTimeout(400);
  console.log('Blocks saving an over-ceiling rate:', await page.evaluate(() => regStep) === 1);
  // No floor any more: a worker willing to work for less is allowed to say so,
  // so a rate under the usual range must NOT be warned about.
  await carp.locator('.sd-price').fill('50');
  await page.waitForTimeout(250);
  console.log('A low rate is not flagged:', !(await carp.locator('.band').innerText()).includes('Too'));
  await carp.locator('.sd-price').fill('0');
  await page.waitForTimeout(250);
  console.log('Nor is zero:', !(await carp.locator('.band').innerText()).includes('Too'));
  await carp.locator('.sd-price').fill('900');
  await page.waitForTimeout(250);
  console.log('Back in range clears the warning:', !(await carp.locator('.band').innerText()).includes('Too'));

  await page.locator('#stepNext').click();
  await page.waitForTimeout(500);
  console.log('Wizard step after choosing work:', await page.evaluate(() => regStep));

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DwnwEKmBhQAAAA//8DVgn+/hZorNMAAAAASUVORK5CYII=', 'base64');
  await page.locator('#uploadAlt').click().catch(()=>{});
  await page.setInputFiles('#selfieInput', { name: 's.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(500);
  console.log('Photo set:', await page.locator('#photoThumb img').count() === 1);
  await page.locator('#stepNext').click();
  await page.waitForTimeout(500);
  console.log('Wizard step after the photo:', await page.evaluate(() => regStep));
  console.log('City locked:', await page.locator('#regCity').inputValue(), '/ readonly:', await page.locator('#regCity').getAttribute('readonly') !== null);
  await page.selectOption('#regArea', 'Jalukbari');
  console.log('Locality options:', await page.locator('#regArea option').count(),
              'in', await page.locator('#regArea optgroup').count(), 'zones');
  console.log('Zones:', (await page.locator('#regArea optgroup').evaluateAll(g => g.map(x => x.label))).join(' | '));
  console.log('Localities are unique:', await page.locator('#regArea option').evaluateAll(o => {
    const v = o.map(x => x.textContent.trim()).filter(t => t !== 'Select your locality');
    return v.length === new Set(v).size;
  }));
  console.log('Has Six Mile / Jalukbari / Paltan Bazar:', await page.locator('#regArea option').evaluateAll(o => {
    const v = o.map(x => x.textContent.trim());
    return ['Six Mile','Jalukbari','Paltan Bazar'].every(n => v.includes(n));
  }));
  await page.locator('#regLocBtn').click();
  await page.waitForTimeout(900);
  console.log('Location captured:', (await page.locator('#regLocText').textContent()).includes('saved'));
  await page.screenshot({ path: 'ks-register.png' });

  await page.locator('#stepNext').click();
  await page.waitForTimeout(500);
  console.log('Wizard step before publishing:', await page.evaluate(() => regStep));

  // consent must be given, not assumed
  console.log('Consent block shown on first publish:', await page.locator('#consentBlock:visible').count() === 1);
  await page.locator('#regSaveBtn').click();
  await page.waitForTimeout(400);
  console.log('Blocks publishing without consent:', await page.locator('#scr-register.on').count() === 1);
  await page.locator('#consentPublish').check();
  await page.locator('#regSaveBtn').click();
  await page.waitForTimeout(400);
  console.log('Blocks publishing without the 18+ confirmation:', await page.locator('#scr-register.on').count() === 1);
  await page.locator('#consentAge').check();

  await page.locator('#regSaveBtn').click();
  await page.waitForTimeout(900);
  console.log('Congratulations screen shown:', await page.locator('#scr-done.on').count() === 1);
  console.log('  message:', (await page.locator('#scr-done .sub').innerText()).trim());
  console.log('  mentions the free trial:', (await page.locator('#scr-done').innerText()).includes('30 days free'));
  console.log('  names the number to expect a reply on:', (await page.locator('#donePhone').innerText()).includes('9435012345'));
  await page.locator('#doneMine').click();
  await page.waitForTimeout(500);
  console.log('Profile published:', await page.locator('#scr-me.on').count() === 1);
  console.log('Profile lists rates:', await page.locator('.rate-item').count());
  await page.screenshot({ path: 'ks-me.png' });

  console.log('Shows pending review:', await page.locator('.vstatus.pending').count() === 1);
  await page.evaluate(() => go('hire'));
  await page.waitForTimeout(800);
  await page.fill('#hireSearch', 'Salinur');
  await page.waitForTimeout(400);
  console.log('Unverified worker hidden from search (expect 0):', await page.locator('.wcard').count());
  await page.locator('#clearSearch').click();
  await page.waitForTimeout(400);

  // admin approval flow
  const adminPage = await ctx.newPage();
  adminPage.on('dialog', d => d.accept('4242'));
  await adminPage.goto('http://localhost:8777/#admin');
  await adminPage.waitForTimeout(1400);
  console.log('Admin screen opens with PIN:', await adminPage.locator('#scr-admin.on').count() === 1);
  await adminPage.locator('#scr-admin .tab', { hasText: 'Review' }).click();
  await adminPage.waitForTimeout(900);
  console.log('Pending profile listed:', (await adminPage.locator('.admin-card').first().locator('h4').innerText()).replace(/\n/g,' '));
  console.log('Admin has OTP requirement toggle:', await adminPage.locator('#otpSwitch').count() === 1);
  const expect = (await adminPage.locator('.wa-expect').first().innerText()).replace(/\s+/g,' ').trim();
  console.log('Admin shows the code to match:', expect);
  console.log('Code shown matches the one issued:', expect.includes(waCode) && expect.includes('9435012345'));

  // reject first, with a reason, then approve.
  // Rejection is a sheet of preset reasons now, not a prompt() — picking from a
  // list is what makes the reason the worker reads consistent and actionable.
  await adminPage.locator('.admin-card').first().locator('button', { hasText: 'Reject' }).click();
  await adminPage.waitForTimeout(600);
  console.log('Reject sheet opens:', await adminPage.locator('#rejectOverlay.open').count() === 1);
  const reasons = await adminPage.locator('.reject-opt').allTextContents();
  console.log('Preset reasons offered:', reasons.length);
  const REJECT_REASON = reasons[0].trim();
  await adminPage.locator('.reject-opt').first().click();
  await adminPage.waitForTimeout(900);
  console.log('Reject sheet closes:', await adminPage.locator('#rejectOverlay.open').count() === 0);
  console.log('Rejected section appears:', (await adminPage.locator('#adminPanel').innerText()).includes('Rejected'));
  console.log('Reason recorded:', (await adminPage.locator('#adminPanel').innerText()).includes(REJECT_REASON));

  // worker sees the rejection and the reason
  await page.reload();
  await page.waitForTimeout(1200);
  await page.evaluate(() => go('me'));
  await page.waitForTimeout(500);
  /* Scoped to #meCard on purpose: the registration wizard now carries a
     second, hidden copy of this block so the reason travels with somebody
     going back to fix their profile, and an unscoped selector reads that
     one — silently, since it is hidden and therefore empty. */
  console.log('Worker sees rejection:', await page.locator('#meCard .vstatus.rejected').count() === 1);
  console.log('Worker sees the reason:',
    (await page.locator('#meCard .vstatus.rejected').innerText()).includes(REJECT_REASON));

  await adminPage.evaluate(() => renderAdmin());
  await adminPage.waitForTimeout(600);
  await adminPage.locator('.btn-brand', { hasText: 'Approve' }).first().click();
  await adminPage.waitForTimeout(700);
  const wrongPin = await ctx.newPage();
  wrongPin.on('dialog', d => d.accept('0000'));
  await wrongPin.goto('http://localhost:8777/#admin');
  await wrongPin.waitForTimeout(1200);
  console.log('Wrong admin PIN blocked:', await wrongPin.locator('#scr-admin.on').count() === 0);
  await wrongPin.close();
  await adminPage.close();

  await page.reload();
  await page.waitForTimeout(1200);
  await page.evaluate(() => go('hire'));
  await page.waitForTimeout(900);
  await page.fill('#hireSearch', 'Salinur');
  await page.waitForTimeout(400);
  console.log('Approved worker now visible (expect 1):', await page.locator('.wcard').count());
  console.log('Number counts as verified after approval:', await page.evaluate(
    () => (JSON.parse(localStorage.getItem('nearse_workers_v1')).find(w => w.phone === '9435012345')||{}).phone_verified === true));
  await page.locator('#clearSearch').click();
  await page.waitForTimeout(400);

  // ---- hire side ----
  console.log('Workers listed:', await page.locator('.wcard').count());
  console.log('Nearest first:', (await page.locator('.wcard h3').first().textContent()).trim());
  console.log('Card shows locality + distance:', (await page.locator('.wcard .where').first().innerText()).trim());
  await page.screenshot({ path: 'ks-hire.png' });

  // ---- locality filter ----
  console.log('Filter zones (only where workers exist):',
              (await page.locator('#areaFilter optgroup').evaluateAll(g => g.map(x => x.label))).join(' | '));
  console.log('Filter localities:', (await page.locator('#areaFilter option').allTextContents()).map(t=>t.trim()).join(', '));
  await page.selectOption('#areaFilter', 'Jalukbari');
  await page.waitForTimeout(400);
  console.log('Filter to Jalukbari:', await page.locator('.wcard').count(),
              '| meta:', (await page.locator('#resultMeta').innerText()).replace(/\n/g, ' / '));
  await page.selectOption('#areaFilter', 'Six Mile');
  await page.waitForTimeout(400);
  console.log('Filter to Six Mile:', await page.locator('.wcard').count(),
              '| card locality:', (await page.locator('.wcard .where').first().innerText()).trim());
  await page.fill('#hireSearch', 'plumber');
  await page.waitForTimeout(400);
  console.log('Six Mile + "plumber" (expect 0, with escape hatch):',
              await page.locator('.wcard').count(), '|', (await page.locator('.empty').innerText()).replace(/\n/g,' '));
  await page.locator('.empty .linkish').click();
  await page.waitForTimeout(400);
  console.log('Escape hatch clears locality:', await page.locator('.wcard').count() > 0,
              '| filter reset:', await page.locator('#areaFilter').inputValue() === '');
  await page.locator('#clearSearch').click();
  await page.waitForTimeout(300);

  await page.fill('#hireSearch', 'cook');
  await page.waitForTimeout(400);
  console.log('Search "cook":', await page.locator('.wcard').count());
  await page.fill('#hireSearch', 'maid');
  await page.waitForTimeout(400);
  console.log('Search "maid":', await page.locator('.wcard').count());
  await page.fill('#hireSearch', 'carpenter');
  await page.waitForTimeout(400);
  console.log('Search "carpenter":', await page.locator('.wcard').count());
  await page.locator('#clearSearch').click();
  await page.waitForTimeout(300);

  // Categories are tiles now, not a row of chips; selecting one toggles it.
  const tutorTile = page.locator('.tile', { hasText: 'Tutors' }).first();
  await tutorTile.click();
  await page.waitForTimeout(500);
  console.log('Category "Tutors" filter:', await page.locator('.wcard').count());
  console.log('Selected tile is marked pressed:',
              await page.locator('.tile.on[aria-pressed="true"]').count() === 1);
  await tutorTile.click();                       // tapping it again clears the filter
  await page.waitForTimeout(400);
  console.log('Tapping it again clears the filter:',
              await page.locator('.tile.on').count() === 0);
  /* The trade chips are the search box's suggestions now, not a permanent
     band above it, so they appear on focus — which is also when somebody
     would actually be looking for one. */
  await page.locator('#hireSearch').focus();
  await page.waitForTimeout(350);
  await page.locator('.suggest', { hasText: 'Plumber' }).first().click();
  await page.waitForTimeout(500);
  console.log('Suggestion chip search works:', await page.locator('.wcard').count() > 0);
  await page.locator('#clearSearch').click();
  await page.waitForTimeout(300);

  // detail + booking.
  // There is deliberately no star box on the profile any more: anyone could
  // rate anyone, as often as they liked. A review now comes off a finished
  // booking instead, which test-threads covers end to end.
  await page.locator('.wcard').first().click();
  await page.waitForTimeout(400);
  console.log('Detail rate rows:', await page.locator('.price-line').count());
  console.log('No drive-by rating box on the profile:',
              await page.locator('#rateStars').count() === 0);
  await page.locator('#bookCta').click();
  await page.waitForTimeout(400);
  // The booking sheet was replaced by the request wizard, which asks for the
  // job before it asks for you, and opens a thread rather than a WhatsApp
  // link. tests/test-direct-booking.js and tests/test-wizard.js cover it in
  // full, so this journey stops at the point where they take over.
  console.log('Booking opens the request sheet:',
              await page.locator('.overlay.open').count() > 0,
              '|', await page.evaluate(() => {
                const o = document.querySelector('.overlay.open');
                return o ? o.id : 'none';
              }));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ---- sign out / sign in / wrong pin ----
  await page.evaluate(() => go('me'));
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: 'Sign out' }).click();
  await page.waitForTimeout(400);
  await page.locator('#tabFab').click();
  await page.waitForTimeout(300);
  await page.fill('#inPhone', '9435012345');
  await page.fill('#inPin', '4321');
  await page.locator('#signInBtn').click();
  await page.waitForTimeout(700);
  console.log('Sign in returns to profile:', await page.locator('#scr-me.on').count() === 1);
  await page.locator('button', { hasText: 'Sign out' }).click();
  await page.waitForTimeout(400);
  await page.locator('#tabFab').click();
  await page.fill('#inPhone', '9435012345');
  await page.fill('#inPin', '0000');
  await page.locator('#signInBtn').click();
  await page.waitForTimeout(600);
  console.log('Wrong PIN rejected:', await page.locator('#scr-work.on').count() === 1);

  // ---- delete my profile (right to erasure / Play Store requirement) ----
  await page.fill('#inPhone', '9435012345');
  await page.fill('#inPin', '4321');
  await page.locator('#signInBtn').click();
  await page.waitForTimeout(700);
  console.log('Signed back in for deletion test:', await page.locator('#scr-me.on').count() === 1);
  console.log('Delete control present:', await page.locator('.danger-zone button').count() === 1);

  // Deletion runs through the leave flow now — what goes, then why you are
  // leaving — rather than two browser dialogs. tests/test-leaving.js covers
  // every branch; here we only check it ends in an erased profile.
  await page.locator('.danger-zone button').click();
  await page.waitForTimeout(700);
  console.log('Leave flow opens:', await page.locator('#leaveOverlay.open').count() === 1);
  await page.locator('#leaveStep1 .btn-danger').click();
  await page.waitForTimeout(500);
  console.log('It asks why before it deletes:', await page.locator('#leaveStep2:visible').count() === 1);
  await page.locator('.leave-reason').first().click();
  await page.waitForTimeout(200);
  await page.locator('#leaveGoBtn').click();
  await page.waitForTimeout(1200);
  console.log('Deleted:', await page.locator('#leaveStep3:visible').count() === 1);
  await page.locator('#leaveStep3 .btn-brand').click();
  await page.waitForTimeout(600);
  console.log('Returned home:', await page.locator('#scr-home.on').count() === 1);
  console.log('Profile really gone from store:', await page.evaluate(
    () => !JSON.parse(localStorage.getItem('nearse_workers_v1')).some(w => w.phone === '9435012345')));
  await page.evaluate(() => go('hire'));
  await page.waitForTimeout(900);
  await page.fill('#hireSearch', 'Salinur');
  await page.waitForTimeout(400);
  console.log('Gone from customer search (expect 0):', await page.locator('.wcard').count());

  // desktop screenshots
  const desk = await ctx.newPage();
  await desk.setViewportSize({ width: 1280, height: 860 });
  await desk.goto('http://localhost:8777/');
  await desk.waitForTimeout(900);
  await desk.screenshot({ path: 'ks-landing-desk.png' });
  await desk.locator('.see-all').click();
  await desk.waitForTimeout(1000);
  await desk.screenshot({ path: 'ks-hire-desk.png' });

  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
  srv.close();
})();
