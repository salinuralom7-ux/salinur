/**
 * Store-wide configuration.
 *
 * Everything here belongs to Budget Phone Store as an independent business.
 * The contact email below is the only account identity the storefront uses —
 * it is deliberately not tied to any other project or personal account.
 */

export const STORE = {
  name: 'Budget Phone Store',
  tagline: 'Certified second-hand phones, honestly graded',
  city: 'Bongaigaon',
  state: 'Assam',
  country: 'India',

  /** Every store account (Razorpay, hosting, mail) is registered to this address. */
  email: 'budgetphonestorebongaigaon@gmail.com',

  /**
   * WhatsApp number used for real-photo requests and order support.
   * Country code, no plus sign, no spaces — e.g. '919876543210'.
   * Replace this placeholder with the shop's real WhatsApp business number.
   */
  whatsapp: '910000000000',

  addressLines: ['Budget Phone Store', 'Bongaigaon, Assam 783380', 'India'],

  hours: 'Mon–Sat, 10:00 am – 8:00 pm IST',
} as const;

/** Commercial policy constants. Changing these changes the whole storefront. */
export const POLICY = {
  /**
   * Cash-on-delivery bookings must be secured by an online booking charge of at
   * least one tenth of the order total. The rest is collected on delivery.
   */
  minBookingFraction: 0.1,

  /** Booking charge is rounded up to a whole multiple of this many rupees. */
  bookingRoundTo: 10,

  /** Orders at or above this value ship free. */
  freeShippingAbove: 15000,
  shippingFlat: 199,
  expressSurcharge: 250,

  /** COD is not offered above this order value — too much cash on the road. */
  codMaxOrderValue: 120000,

  returnWindowDays: 7,
  inspectionWindowMinutes: 15,
} as const;
