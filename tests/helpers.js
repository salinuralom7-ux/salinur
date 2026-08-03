/* Shared setup every customer-side test needs.

   Booking is behind an account now, so a test that drives a booking has to be
   signed in first or it lands on the sign-up screen and everything after it
   fails for a reason that has nothing to do with what the test is about.
   Doing it through the app's own registerCustomer/customerMe rather than by
   forging localStorage means these tests break if the account plumbing does,
   which is the point. */
const DEMO = { phone: '9876543210', pin: '4321', name: 'Priya Das', area: 'Six Mile' };

async function signInDemoCustomer(page, who = {}) {
  const c = { ...DEMO, ...who };
  await page.evaluate(async c => {
    /* the one-off "create an account?" sheet would otherwise pop over
       whatever the test is doing about five seconds in */
    localStorage.setItem('repto_account_asked_v1', '1');
    let token = await api.loginCustomer(c.phone, c.pin);
    if (!token) token = await api.registerCustomer(c.phone, c.pin, c.name, c.area);
    const me = await api.customerMe(token);
    customer = { token, ...(me || {}) };
    saveCustomer();
    paintAccountUi();
  }, c);
  return c;
}

/* For tests that only need the offer sheet out of the way. */
const silenceAccountOffer = page =>
  page.evaluate(() => localStorage.setItem('repto_account_asked_v1', '1'));

module.exports = { DEMO, signInDemoCustomer, silenceAccountOffer };
