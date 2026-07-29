const { chromium } = require('playwright');
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

  // ---- landing: exactly two doors ----
  console.log('Landing buttons (expect 2):', await page.locator('.cta').count());
  console.log('Button order:', (await page.locator('.cta .cta-text b').allTextContents()).join(' | '));
  console.log('Both doors carry an animated illustration:',
              await page.locator('#ctaHire .art-find').count() === 1 &&
              await page.locator('#ctaWork .art-worker').count() === 1);
  console.log('Worker arm animates:', await page.evaluate(
    () => getComputedStyle(document.querySelector('.art-worker .arm')).animationName));
  console.log('Binoculars scan animates:', await page.evaluate(
    () => getComputedStyle(document.querySelector('.art-find .scan')).animationName));
  console.log('Card title and subtitle stack:', await page.evaluate(
    () => getComputedStyle(document.querySelector('.cta-text')).flexDirection));
  console.log('First is a real button:', await page.evaluate(() => document.querySelector('.cta').tagName));
  console.log('Dark theme:', await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
  console.log('Catalogue size:', await page.evaluate(() => SKILLS.length), 'services in',
              await page.evaluate(() => CATALOGUE.length), 'categories');
  console.log('No emoji in landing copy:', !/[\u{1F300}-\u{1FAFF}]/u.test(await page.locator('#scr-home').innerText()));
  await page.screenshot({ path: 'ks-landing.png' });

  // ---- worker side: banner + auth ----
  await page.locator('#ctaWork').click();
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
  console.log('Link targets the new Repto number:', waHref.startsWith('https://wa.me/917086599367?text='));
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
  console.log('Picked 3 services:', await page.locator('.picked-card').count());
  console.log('Counter reads:', (await page.locator('#skillCount').textContent()).trim());
  console.log('4th service disabled:', await page.locator('.svc-row[disabled]').count() > 0);

  console.log('Rate band shown for Electrician:', (await page.locator('.picked-card .band').first().innerText()).trim());
  const cards = page.locator('.picked-card');
  const rates = ['450', '900', '400'];
  for (let i = 0; i < 3; i++) {
    await cards.nth(i).locator('.sd-price').fill(rates[i]);
    await cards.nth(i).locator('.sd-exp').fill((i + 3) + ' years');
  }
  // price validation
  await cards.nth(0).locator('.sd-price').fill('');
  await page.locator('#regSaveBtn').click();
  await page.waitForTimeout(300);
  console.log('Blocks empty rate:', await page.locator('#scr-register.on').count() === 1);

  // a carpenter at Rs 9,000/day is nonsense and must be refused
  const carp = page.locator('.picked-card', { hasText: 'Carpenter' });
  await carp.locator('.sd-price').fill('9000');
  await page.waitForTimeout(250);
  console.log('Over-ceiling flagged live:', (await carp.locator('.band').innerText()).includes('Too high'));
  await cards.nth(0).locator('.sd-price').fill('450');
  await page.locator('#regSaveBtn').click();
  await page.waitForTimeout(400);
  console.log('Blocks saving an over-ceiling rate:', await page.locator('#scr-register.on').count() === 1);
  await carp.locator('.sd-price').fill('50');
  await page.waitForTimeout(250);
  console.log('Under-floor flagged live:', (await carp.locator('.band').innerText()).includes('Too low'));
  await carp.locator('.sd-price').fill('900');
  await page.waitForTimeout(250);
  console.log('Back in range clears the warning:', !(await carp.locator('.band').innerText()).includes('Too'));

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DwnwEKmBhQAAAA//8DVgn+/hZorNMAAAAASUVORK5CYII=', 'base64');
  await page.locator('#uploadAlt').click().catch(()=>{});
  await page.setInputFiles('#selfieInput', { name: 's.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(500);
  console.log('Photo set:', await page.locator('#selfieCircle img').count() === 1);
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
  await page.locator('#scr-done .btn-brand').click();
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
  console.log('Dashboard is the landing tab:', await adminPage.locator('.stat-grid').count() > 0);
  console.log('Dashboard flags what needs attention:',
              (await adminPage.locator('.todo-bar').innerText()).replace(/\n/g, ' — '));
  await adminPage.locator('.admin-tabs .tab', { hasText: 'Review' }).click();
  await adminPage.waitForTimeout(900);
  console.log('Pending profile listed:', (await adminPage.locator('.admin-card').first().locator('h4').innerText()).replace(/\n/g,' '));
  console.log('Admin has OTP requirement toggle:', await adminPage.locator('#otpSwitch').count() === 1);
  const expect = (await adminPage.locator('.wa-expect').first().innerText()).replace(/\s+/g,' ').trim();
  console.log('Admin shows the code to match:', expect);
  console.log('Code shown matches the one issued:', expect.includes(waCode) && expect.includes('9435012345'));

  // reject first, with a reason, then approve
  adminPage.removeAllListeners('dialog');
  adminPage.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Photo is not a clear face' : '4242'));
  await adminPage.locator('.admin-card').first().locator('button', { hasText: 'Reject' }).click();
  await adminPage.waitForTimeout(700);
  console.log('Rejected section appears:', (await adminPage.locator('#adminPanel').innerText()).includes('Rejected'));
  console.log('Reason recorded:', (await adminPage.locator('#adminPanel').innerText()).includes('Photo is not a clear face'));

  // worker sees the rejection and the reason
  await page.reload();
  await page.waitForTimeout(1200);
  await page.evaluate(() => go('me'));
  await page.waitForTimeout(500);
  console.log('Worker sees rejection:', await page.locator('.vstatus.rejected').count() === 1);
  console.log('Worker sees the reason:', (await page.locator('.vstatus.rejected').innerText()).includes('Photo is not a clear face'));

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

  await page.locator('.cat-chip', { hasText: 'Tutors & Coaching' }).click();
  await page.waitForTimeout(400);
  console.log('Category "Tutors" filter:', await page.locator('.wcard').count());
  await page.locator('.cat-chip', { hasText: 'All services' }).click();
  await page.waitForTimeout(300);
  await page.locator('.suggest', { hasText: 'Plumber' }).first().click();
  await page.waitForTimeout(400);
  console.log('Suggestion chip search works:', await page.locator('.wcard').count() > 0);
  await page.locator('#clearSearch').click();
  await page.waitForTimeout(300);

  // detail + rating + booking
  await page.locator('.wcard').first().click();
  await page.waitForTimeout(400);
  console.log('Detail rate rows:', await page.locator('.price-line').count());
  // the pass-by rating box is gone: a score can only come from a job that
  // finished, through the conversation
  console.log('No pass-by rating box:', await page.locator('#rateStars').count() === 0);
  // an electrician is dispatched instantly now, so this door opens the NOW sheet
  console.log('Detail CTA reflects the mode:', (await page.locator('#bookCta').textContent()).trim(),
              '|', (await page.locator('#bookCtaNote').textContent()).trim());
  await page.locator('#bookCta').click();
  await page.waitForTimeout(400);
  console.log('Instant sheet opens for an electrician:', await page.locator('#nowOverlay.open').count() === 1);
  console.log('Instant sheet never asks for a time:', await page.locator('#nowOverlay #bookWhen').count() === 0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // a monthly tutor is an enquiry, and still uses the date-and-slot sheet
  await page.evaluate(() => go('hire'));
  await page.waitForTimeout(600);
  await page.fill('#hireSearch', 'Priya');
  await page.waitForTimeout(500);
  await page.locator('.wcard').first().click();
  await page.waitForTimeout(400);
  console.log('Tutor CTA reflects the mode:', (await page.locator('#bookCta').textContent()).trim());
  await page.locator('#bookCta').click();
  await page.waitForTimeout(400);
  console.log('Booking: service options:', await page.locator('#bookServices .opt').count(),
              '| first preselected:', await page.locator('#bookServices .opt.on').count() === 1);
  console.log('Booking: when options:', (await page.locator('#bookWhen .opt').allTextContents()).map(t=>t.trim().split('\n')[0]).join(' | '));
  console.log('Booking: area options:', await page.locator('#bookArea option').count());
  console.log('Booking: quote visible:', await page.locator('#bookQuote.on').count() === 1);
  await page.locator('#bookWhen .opt', { hasText: 'Pick a date' }).click();
  await page.waitForTimeout(200);
  console.log('Booking: date input revealed:', await page.locator('#bookDate').isVisible());
  await page.locator('#bookWhen .opt', { hasText: 'Tomorrow' }).click();
  await page.waitForTimeout(200);
  console.log('Booking: date input hidden again:', !(await page.locator('#bookDate').isVisible()));
  await page.fill('#bookName', 'Test Customer');
  await page.fill('#bookPhone', '9876543210');
  await page.screenshot({ path: 'ks-booking.png' });
  await page.selectOption('#bookArea', '');
  await page.locator('#confirmBookBtn').click();
  await page.waitForTimeout(300);
  console.log('Booking: blocks missing area:', await page.locator('#bookOverlay.open').count() === 1);
  await page.selectOption('#bookArea', 'Six Mile');
  await page.waitForTimeout(200);
  console.log('Booking: quote picks up area:', (await page.locator('#bookQuote').innerText()).includes('Six Mile'));
  await page.keyboard.press('Escape');

  // ---- sign out / sign in / wrong pin ----
  await page.evaluate(() => go('me'));
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: 'Sign out' }).click();
  await page.waitForTimeout(400);
  await page.locator('#ctaWork').click();
  await page.waitForTimeout(300);
  await page.fill('#inPhone', '9435012345');
  await page.fill('#inPin', '4321');
  await page.locator('#signInBtn').click();
  await page.waitForTimeout(700);
  console.log('Sign in returns to profile:', await page.locator('#scr-me.on').count() === 1);
  await page.locator('button', { hasText: 'Sign out' }).click();
  await page.waitForTimeout(400);
  await page.locator('#ctaWork').click();
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

  // a wrong confirmation word must NOT delete
  page.removeAllListeners('dialog');
  page.on('dialog', d => d.type() === 'confirm' ? d.accept() : d.accept('nope'));
  await page.locator('.danger-zone button').click();
  await page.waitForTimeout(600);
  console.log('Survives a mistyped confirmation:', await page.locator('#scr-me.on').count() === 1);

  // cancelling the first dialog must NOT delete
  page.removeAllListeners('dialog');
  page.on('dialog', d => d.dismiss());
  await page.locator('.danger-zone button').click();
  await page.waitForTimeout(600);
  console.log('Survives cancelling:', await page.locator('#scr-me.on').count() === 1);

  page.removeAllListeners('dialog');
  page.on('dialog', d => d.type() === 'confirm' ? d.accept() : d.accept('DELETE'));
  await page.locator('.danger-zone button').click();
  await page.waitForTimeout(900);
  console.log('Deleted and returned home:', await page.locator('#scr-home.on').count() === 1);
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
  await desk.locator('#ctaHire').click();
  await desk.waitForTimeout(1000);
  await desk.screenshot({ path: 'ks-hire-desk.png' });

  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
  srv.close();
})();
