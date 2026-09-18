// builds/PreflightCore/sample — embedded verbatim for the "Load sample (collections)" button (01 §5 step 1).
export const SAMPLE_CONTACTS_CSV = `id,phone,preferredLanguage,consentPromotional
B-1001,+919812340001,hindi,yes
B-1002,+919812340002,english,yes
B-1003,+919812340003,tamil,
B-1004,+919812340004,english,no
B-1005,+919812340005,,yes
B-1006,+919812340006,telugu,
B-1007,+919812340007,english,yes
B-1008,+919812340008,marathi,no
B-1009,+919812340009,english,
B-1010,+919812340010,kannada,yes
B-1011,+919812340011,english,yes
B-1012,+919812340012,bengali,
`;

export const SAMPLE_COLLECTIONS = {
  message: 'Dear customer, your EMI of Rs 8,450 is overdue since 28 Aug. Please pay immediately to avoid additional charges. Pay now: pay.example-nbfc.in/x7f2',
  channel: 'whatsapp' as const,
  purpose: 'collections' as const,
  borrowerSegment: 'retail',
  template: {
    body: 'Dear customer, your EMI of Rs {{1}} is overdue since {{2}}. Please pay immediately to avoid additional charges. Pay now: {{3}}',
    variables: ['8,450', '28 Aug'],
  },
  /** 20:15 IST — the "catch them after work" choice that breaches the recovery window */
  time: '20:15',
};

/** One month ahead of `now` (date part only), so the sample is always schedulable. */
export function sampleDate(now: Date = new Date()): string {
  const d = new Date(now.getTime() + 330 * 60_000);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
