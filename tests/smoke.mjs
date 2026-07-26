/**
 * End-to-end walk-through of the whole purchase: search, variant selectors,
 * the photo request, the cash-on-delivery booking charge and its arithmetic,
 * placing the order, and a mobile-width overflow check.
 *
 * Playwright is not a dependency of this project — it would pull a browser
 * download into every deploy. Install it only when you want to run this:
 *
 *   npm install --no-save playwright
 *   npm run build && npm run preview   # in another terminal
 *   npm run smoke
 *
 * Screenshots land in .smoke/ (gitignored). Override with SMOKE_SHOTS,
 * the target with SMOKE_BASE_URL, and the browser with CHROMIUM_PATH.
 */

import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4173';
const SHOTS = process.env.SMOKE_SHOTS ?? '.smoke';
const errors = [];
const steps = [];

function ok(label, detail = '') {
  const line = `  ✓ ${label}${detail ? ' — ' + detail : ''}`;
  steps.push(line);
  console.log(line);
}

// Let Playwright resolve its own browser unless one is pinned in the env.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push('console: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => {
  // /api/* 404s under `vite preview`: there is no serverless runtime there, and
  // the client is expected to fall back to test mode. Anything else is a fault.
  if (r.status() >= 400 && !r.url().includes('/api/')) errors.push(`http ${r.status()} ${r.url()}`);
});

// ---- Home -----------------------------------------------------------------
await page.goto(BASE, { waitUntil: 'networkidle' });
ok('home loads', await page.locator('h1').first().innerText());
await page.screenshot({ path: `${SHOTS}/01-home.png`, fullPage: false });

const brandCards = await page.locator('.brand-card').count();
const conditionCards = await page.locator('.condition-card').count();
ok('categories rendered', `${brandCards} brands, ${conditionCards} conditions`);

// ---- Search ---------------------------------------------------------------
await page.fill('.search input', 'iphone 13');
await page.press('.search input', 'Enter');
await page.waitForURL('**/shop?q=*');
await page.waitForSelector('.model-card');
const results = await page.locator('.model-card').count();
ok('search "iphone 13"', `${results} models`);
await page.screenshot({ path: `${SHOTS}/02-search.png` });

// ---- Filter by condition --------------------------------------------------
await page.locator('.filter-group', { hasText: 'Condition' }).getByText('Superb').click();
await page.waitForTimeout(400);
ok('condition filter applied', `${await page.locator('.model-card').count()} models`);

// ---- Brand category page --------------------------------------------------
await page.goto(`${BASE}/brand/apple`, { waitUntil: 'networkidle' });
const seriesBlocks = await page.locator('.series-block').count();
ok('Apple brand page', `${seriesBlocks} series, ${await page.locator('.model-card').count()} models`);
await page.screenshot({ path: `${SHOTS}/03-brand.png` });

// ---- Condition category page ---------------------------------------------
await page.goto(`${BASE}/condition/superb`, { waitUntil: 'networkidle' });
ok('Superb condition page', await page.locator('h1').first().innerText());

// ---- Product detail: variant selectors ------------------------------------
await page.goto(`${BASE}/phone/iphone-13`, { waitUntil: 'networkidle' });
const priceBefore = await page.locator('.price-now').innerText();
const storages = await page.locator('.picker-btn').count();
const swatches = await page.locator('.swatch').count();
const conditions = await page.locator('.condition-option').count();
ok('product page', `${storages} storages, ${swatches} colours, ${conditions} conditions`);

// change storage
await page.locator('.picker-btn').nth(1).click();
await page.waitForTimeout(250);
const priceAfterStorage = await page.locator('.price-now').innerText();
ok('storage change repriced', `${priceBefore} -> ${priceAfterStorage}`);

// change colour
const enabledSwatch = page.locator('.swatch:not(.is-out)').nth(2);
await enabledSwatch.click();
await page.waitForTimeout(250);
const colourNow = await page.locator('.picker legend', { hasText: 'Colour' }).innerText();
ok('colour change', colourNow.replace(/\s+/g, ' '));

// change condition to Moderate (cheapest)
const modOption = page.locator('.condition-option:not(.is-out)').last();
await modOption.click();
await page.waitForTimeout(250);
const priceAfterCondition = await page.locator('.price-now').innerText();
ok('condition change repriced', `now ${priceAfterCondition}`);
await page.screenshot({ path: `${SHOTS}/04-product.png`, fullPage: false });

// ---- Photo request dialog -------------------------------------------------
await page.click('text=See the real photos');
await page.waitForSelector('dialog[open]');
ok('photo request dialog opens');
await page.screenshot({ path: `${SHOTS}/05-photos.png` });
await page.locator('dialog .icon-btn').click();
await page.waitForTimeout(200);

// ---- Add to cart ----------------------------------------------------------
await page.click('text=Add to cart');
await page.waitForTimeout(300);
await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
const cartLines = await page.locator('.cart-line').count();
const cartTotal = await page.locator('.summary-total dd').innerText();
ok('cart', `${cartLines} line(s), total ${cartTotal}`);

// ---- Checkout -------------------------------------------------------------
await page.click('text=Checkout');
await page.waitForURL('**/checkout');

await page.fill('input[autocomplete="name"]', 'Test Buyer');
await page.fill('input[autocomplete="tel-national"]', '9876543210');
await page.fill('input[type="email"]', 'buyer@example.com');
await page.fill('input[autocomplete="address-line1"]', '12 Station Road, Ward 4');
await page.fill('input[autocomplete="address-level2"]', 'Bongaigaon');
await page.fill('input[autocomplete="postal-code"]', '783380');
await page.click('text=Continue to delivery');
await page.waitForTimeout(300);
ok('address step accepted');

await page.click('text=Continue to payment');
await page.waitForTimeout(300);

// choose COD
await page.locator('.option', { hasText: 'Cash on delivery' }).click();
await page.waitForTimeout(400);
const bookingPanel = await page.locator('.booking-panel').isVisible();
const splitTexts = await page.locator('.booking-split strong').allInnerTexts();
ok('COD booking panel', `visible=${bookingPanel}, online ${splitTexts[0]} + courier ${splitTexts[1]}`);
await page.screenshot({ path: `${SHOTS}/06-booking.png` });

// verify the booking floor is >= 1/10 of total
const totalText = await page.locator('.summary-total dd').innerText();
const parse = (s) => Number(s.replace(/[^\d]/g, ''));
const total = parse(totalText);
const online = parse(splitTexts[0]);
const courier = parse(splitTexts[1]);
if (online < Math.ceil(total / 10)) errors.push(`booking ${online} < 10% of ${total}`);
if (online + courier !== total) errors.push(`split mismatch: ${online}+${courier} != ${total}`);
ok('booking maths', `${online} + ${courier} = ${online + courier} (total ${total}, floor ${Math.ceil(total / 10)})`);

// try the 50% preset and the slider minimum
await page.locator('.chip-btn', { hasText: '50%' }).click();
await page.waitForTimeout(300);
const after50 = await page.locator('.booking-split strong').allInnerTexts();
ok('50% preset', `${after50[0]} online`);

await page.locator('.chip-btn', { hasText: '10%' }).click();
await page.waitForTimeout(300);

await page.click('text=Review the order');
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/07-review.png` });

// place the order (test mode, no gateway configured)
const payBtn = page.locator('.panel button', { hasText: /^Pay /});
ok('pay button', await payBtn.innerText());
await payBtn.click();
await page.waitForURL('**/order/**', { timeout: 15000 });
ok('order placed', page.url().split('/order/')[1]);
await page.screenshot({ path: `${SHOTS}/08-confirmation.png`, fullPage: false });

const confirmText = await page.locator('.confirmation').innerText();
if (!confirmText.includes('test mode')) errors.push('missing test-mode disclosure on confirmation');
ok('test-mode disclosure present');

// ---- Orders page ----------------------------------------------------------
await page.goto(`${BASE}/orders`, { waitUntil: 'networkidle' });
ok('orders page', `${await page.locator('.order-card').count()} order(s)`);

// ---- Help -----------------------------------------------------------------
await page.goto(`${BASE}/help`, { waitUntil: 'networkidle' });
ok('help page', await page.locator('h1').first().innerText());

// ---- Mobile viewport ------------------------------------------------------
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(BASE, { waitUntil: 'networkidle' });
const scrollW = await mobile.evaluate(() => document.documentElement.scrollWidth);
if (scrollW > 391) errors.push(`mobile horizontal overflow: ${scrollW}px`);
ok('mobile home', `scrollWidth ${scrollW}`);
await mobile.screenshot({ path: `${SHOTS}/09-mobile.png` });

await mobile.goto(`${BASE}/phone/iphone-15-pro`, { waitUntil: 'networkidle' });
const scrollW2 = await mobile.evaluate(() => document.documentElement.scrollWidth);
if (scrollW2 > 391) errors.push(`mobile product overflow: ${scrollW2}px`);
ok('mobile product', `scrollWidth ${scrollW2}`);
await mobile.screenshot({ path: `${SHOTS}/10-mobile-product.png`, fullPage: false });

await browser.close();

console.log(steps.join('\n'));
console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.map((e) => '  ✗ ' + e).join('\n') : 'No errors.'));
process.exit(errors.length ? 1 : 0);
