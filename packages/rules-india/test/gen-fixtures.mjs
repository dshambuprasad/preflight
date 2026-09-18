// Emits fixtures/<RULE-ID>.json (11 §2). Run once; commit the output. Each case: input + expected Result.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
mkdirSync(out, { recursive: true });

const ASOF = '2026-09-12T10:00:00+05:30';
const ASOF_2027 = '2027-02-01T10:00:00+05:30';
const ASOF_DPDP = '2027-06-01T10:00:00+05:30';
const coll = (over = {}) => ({ message: 'Your EMI of Rs 8,450 is overdue. Please pay immediately.', channel: 'whatsapp', scheduledAt: '2026-09-14T20:15:00+05:30', purpose: 'collections', borrowerSegment: 'retail', ...over });
const promo = (over = {}) => ({ message: 'Exclusive offer! You are pre-approved for a top-up loan. Apply now.', channel: 'sms', scheduledAt: '2026-09-14T11:00:00+05:30', purpose: 'promotional', ...over });
const C = (id, over = {}) => ({ id, identityKey: `phone:+9198123400${id.slice(-2)}`, ...over });
const base = [C('c01', { preferredLanguage: 'english', consentPromotional: 'granted' }), C('c02', { preferredLanguage: 'tamil', consentPromotional: 'denied' }), C('c03')];
const at = (hhmm, day = '14') => `2026-09-${day}T${hhmm}:00+05:30`;

const fixtures = {
  'A-RBI-001': [
    { name: 'fail 20:15 IST', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'block', affected: ['c01', 'c02', 'c03'] } },
    { name: 'pass 10:00', campaign: coll({ scheduledAt: at('10:00') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'boundary 07:59 fails', campaign: coll({ scheduledAt: at('07:59') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail' } },
    { name: 'boundary 08:00 passes', campaign: coll({ scheduledAt: at('08:00') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'boundary 18:59 passes', campaign: coll({ scheduledAt: at('18:59') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'boundary 19:00 fails', campaign: coll({ scheduledAt: at('19:00') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail' } },
    { name: 'UTC offset: 16:00Z is 21:30 IST', campaign: coll({ scheduledAt: '2026-09-14T16:00:00Z' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail' } },
    { name: 'D29 send window 18:30–21:30 overlaps', campaign: coll({ scheduledAt: at('18:30'), sendWindowEnd: at('21:30') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail' } },
    { name: 'D29 send window 10:00–12:00 inside', campaign: coll({ scheduledAt: at('10:00'), sendWindowEnd: at('12:00') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'cannot: purpose missing', campaign: coll({ purpose: null }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['campaign.purpose'] } },
    { name: 'cannot: scheduledAt garbage', campaign: coll({ scheduledAt: 'soon' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['campaign.scheduledAt'] } },
    { name: 'not applicable: promotional', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-RBI-002': [
    { name: 'fail microfinance 18:30', campaign: coll({ borrowerSegment: 'microfinance', scheduledAt: at('18:30') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'block', affected: ['c01', 'c02', 'c03'] } },
    { name: 'pass microfinance 09:00', campaign: coll({ borrowerSegment: 'microfinance', scheduledAt: at('09:00') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'boundary 08:59 fails', campaign: coll({ borrowerSegment: 'microfinance', scheduledAt: at('08:59') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail' } },
    { name: 'boundary 18:00 fails', campaign: coll({ borrowerSegment: 'microfinance', scheduledAt: at('18:00') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail' } },
    { name: 'cannot: segment missing', campaign: coll({ borrowerSegment: null }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['campaign.borrowerSegment'] } },
    { name: 'not applicable: retail', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-RBI-003': [
    { name: 'fail: tamil vs latin', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'warn', affected: ['c02'] } },
    { name: 'pass: romanised acceptable config', campaign: coll(), contacts: base, config: { romanisedAcceptableLanguages: ['tamil'] }, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'pass: devanagari message to hindi/marathi', campaign: coll({ message: 'आपकी EMI बकाया है' }), contacts: [C('c01', { preferredLanguage: 'hindi' }), C('c02', { preferredLanguage: 'marathi' })], config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'cannot: no language anywhere', campaign: coll(), contacts: [C('c01'), C('c02')], config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['contact.preferredLanguage'] } },
  ],
  'A-RBI-004': [
    { name: 'cannot: no history', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['history.contactEvents'] } },
    { name: 'fail: contact with no prior contact', campaign: coll(), contacts: base, config: {}, asOf: ASOF, tier1: { history: { 'phone:+919812340001': [{ kind: 'sent', channel: 'sms', occurredAt: '2026-08-01T10:00:00Z', source: 'connector:wati' }] } }, expect: { status: 'fail', severity: 'block', affected: ['c02', 'c03'] } },
    { name: 'pass: all previously contacted', campaign: coll(), contacts: [base[0]], config: {}, asOf: ASOF, tier1: { history: { 'phone:+919812340001': [{ kind: 'delivered', channel: 'whatsapp', occurredAt: '2026-08-01T10:00:00Z', source: 'connector:wati' }] } }, expect: { status: 'pass' } },
    { name: 'cannot: purpose missing', campaign: coll({ purpose: null }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['campaign.purpose'] } },
    { name: 'not applicable: promotional', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-RBI-005': [
    { name: 'fail: no cap', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'info', affected: [] } },
    { name: 'fail: cap null', campaign: coll(), contacts: base, config: { frequencyCapPerWeek: null }, asOf: ASOF, expect: { status: 'fail' } },
    { name: 'pass: cap set', campaign: coll(), contacts: base, config: { frequencyCapPerWeek: 2 }, asOf: ASOF, expect: { status: 'pass' } },
  ],
  'A-RBI-006': [
    { name: 'fail warn before 2027', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'warn', affected: ['c02', 'c03'] } },
    { name: 'fail block from 2027-01-01', campaign: promo(), contacts: base, config: {}, asOf: ASOF_2027, expect: { status: 'fail', severity: 'block', affected: ['c02', 'c03'] } },
    { name: 'boundary: 2026-12-31 23:59 IST is still warn (UTC-parsed date)', campaign: promo(), contacts: base, config: {}, asOf: '2026-12-31T23:59:00Z', expect: { status: 'fail', severity: 'warn' } },
    { name: 'boundary: 2027-01-01T00:00Z is block', campaign: promo(), contacts: base, config: {}, asOf: '2027-01-01T00:00:00Z', expect: { status: 'fail', severity: 'block' } },
    { name: 'pass: all granted', campaign: promo(), contacts: [base[0]], config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'cannot: consent absent everywhere', campaign: promo(), contacts: [C('c01'), C('c02')], config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['contact.consentPromotional'] } },
    { name: 'not applicable: collections', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
    { name: 'unknown counts as not consented', campaign: promo(), contacts: [C('c01', { consentPromotional: 'unknown' })], config: {}, asOf: ASOF, expect: { status: 'fail', affected: ['c01'] } },
  ],
  'A-RBI-007': [
    { name: 'cannot: product + scoped consent missing', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['campaign.product', 'consent.productScoped'] } },
    { name: 'cannot: consent not product-scoped', campaign: promo({ product: 'PL' }), contacts: base, config: {}, asOf: ASOF, tier1: { consent: { productScoped: false, records: {} } }, expect: { status: 'cannot_evaluate', missing: ['consent.productScoped'] } },
    { name: 'fail: no per-product consent', campaign: promo({ product: 'PL' }), contacts: base, config: {}, asOf: ASOF_2027, tier1: { consent: { productScoped: true, records: { 'phone:+919812340001|promotional:PL': 'granted' } } }, expect: { status: 'fail', severity: 'block', affected: ['c02', 'c03'] } },
    { name: 'pass', campaign: promo({ product: 'PL' }), contacts: [base[0]], config: {}, asOf: ASOF, tier1: { consent: { productScoped: true, records: { 'phone:+919812340001|promotional:PL': 'granted' } } }, expect: { status: 'pass' } },
    { name: 'not applicable: service', campaign: coll({ purpose: 'service' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-RBI-008': [
    { name: 'fail warn: no opt-out', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'warn', affected: [] } },
    { name: 'fail block from 2027', campaign: promo(), contacts: base, config: {}, asOf: ASOF_2027, expect: { status: 'fail', severity: 'block' } },
    { name: 'pass: Reply STOP', campaign: promo({ message: 'Exclusive offer! Apply now. Reply STOP to opt out.' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'not applicable: collections', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-RBI-011': [
    { name: 'fail: lender not named', campaign: coll(), contacts: base, config: { lenderName: 'Example Finance' }, asOf: ASOF, expect: { status: 'fail', severity: 'warn', affected: [] } },
    { name: 'pass: named', campaign: coll({ message: 'Example Finance: your EMI is overdue.' }), contacts: base, config: { lenderName: 'Example Finance' }, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'cannot: no lenderName', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['config.lenderName'] } },
  ],
  'A-RBI-012': [
    { name: 'not applicable: whatsapp', campaign: promo({ channel: 'whatsapp' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
    { name: 'fail warn: voice 19:45 before 2027', campaign: promo({ channel: 'voice', scheduledAt: at('19:45') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'warn', affected: ['c01', 'c02', 'c03'] } },
    { name: 'fail block: voice 19:45 in 2027', campaign: promo({ channel: 'voice', scheduledAt: at('19:45') }), contacts: base, config: {}, asOf: ASOF_2027, expect: { status: 'fail', severity: 'block' } },
    { name: 'pass: visit 10:00', campaign: promo({ channel: 'visit', scheduledAt: at('10:00') }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'cannot: voice with bad time', campaign: promo({ channel: 'voice', scheduledAt: 'x' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['campaign.scheduledAt'] } },
  ],
  'A-RBI-013': [
    { name: 'cannot: no consent access', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['consent.current'] } },
    { name: 'fail: on DND list', campaign: promo(), contacts: base, config: {}, asOf: ASOF, tier1: { consent: { records: { 'phone:+919812340002|promotional': 'denied' } } }, expect: { status: 'fail', severity: 'block', affected: ['c02'] } },
    { name: 'pass', campaign: promo(), contacts: base, config: {}, asOf: ASOF, tier1: { consent: { records: {} } }, expect: { status: 'pass' } },
    { name: 'not applicable: collections', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-RBI-014': [
    { name: 'fail: loan offer without a rate figure', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'warn', affected: [] } },
    { name: 'pass: rate disclosed', campaign: promo({ message: 'Pre-approved top-up loan at 10.5% p.a. Apply now.' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'pass: processing fee figure', campaign: promo({ message: 'Top-up loan offer. Processing fee Rs 999.' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'not applicable: promotional but not credit', campaign: promo({ message: 'Exclusive offer on our savings account. Apply now.' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
    { name: 'not applicable: collections', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-IN-001': [
    { name: 'cannot: no platform templates', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['platform.templates'] } },
    { name: 'fail: template id not registered', campaign: promo({ template: { body: 'Offer {{1}}', variables: ['x'], externalId: 'T-9' } }), contacts: base, config: {}, asOf: ASOF, tier1: { platform: { templates: [{ externalId: 'T-1', name: 'promo', status: 'APPROVED', category: 'MARKETING', body: 'Offer {{1}}', variableCount: 1 }] } }, expect: { status: 'fail', severity: 'block' } },
    { name: 'pass', campaign: promo({ template: { body: 'Offer {{1}}', variables: ['x'], externalId: 'T-1' } }), contacts: base, config: {}, asOf: ASOF, tier1: { platform: { templates: [{ externalId: 'T-1', name: 'promo', status: 'APPROVED', category: 'MARKETING', body: 'Offer {{1}}', variableCount: 1 }] } }, expect: { status: 'pass' } },
    { name: 'not applicable: whatsapp', campaign: promo({ channel: 'whatsapp' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-IN-002': [
    { name: 'cannot: no dnd access', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['consent.dnd'] } },
    { name: 'fail: dnd registered', campaign: promo(), contacts: base, config: {}, asOf: ASOF, tier1: { consent: { records: {}, dnd: ['phone:+919812340001'] } }, expect: { status: 'fail', severity: 'block', affected: ['c01'] } },
    { name: 'pass', campaign: promo(), contacts: base, config: {}, asOf: ASOF, tier1: { consent: { records: {}, dnd: [] } }, expect: { status: 'pass' } },
    { name: 'not applicable: whatsapp (DND does not apply to OTT)', campaign: promo({ channel: 'whatsapp' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-IN-003': [
    { name: 'fail info: purpose not stated, mixed', campaign: promo({ purpose: null, message: 'Your EMI is due on 5th. You are pre-approved for a top-up loan!' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'info', affected: [] } },
    { name: 'pass: purpose declared', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'pass: high confidence', campaign: promo({ purpose: null }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
  ],
  'A-IN-004': [
    { name: 'fail warn before 2027-05-13', campaign: promo(), contacts: base, config: {}, asOf: ASOF_2027, expect: { status: 'fail', severity: 'warn', affected: ['c02', 'c03'] } },
    { name: 'fail block from 2027-05-13', campaign: promo(), contacts: base, config: {}, asOf: ASOF_DPDP, expect: { status: 'fail', severity: 'block' } },
    { name: 'pass', campaign: promo(), contacts: [base[0]], config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'cannot: consent absent', campaign: promo(), contacts: [C('c01')], config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['contact.consentPromotional'] } },
    { name: 'not applicable: collections', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-IN-005': [
    { name: 'cannot', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['consent.current'] } },
    { name: 'fail: withdrew on whatsapp, sending sms', campaign: promo(), contacts: base, config: {}, asOf: ASOF, tier1: { consent: { records: { 'phone:+919812340001|promotional|whatsapp': 'denied' } } }, expect: { status: 'fail', severity: 'block', affected: ['c01'] } },
    { name: 'pass', campaign: promo(), contacts: base, config: {}, asOf: ASOF, tier1: { consent: { records: {} } }, expect: { status: 'pass' } },
    { name: 'not applicable', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-WA-001': [
    { name: 'pass: template send', campaign: coll({ template: { body: 'Hi {{1}}', variables: ['x'] } }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'cannot: free-form, no history', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['history.contactEvents'] } },
    { name: 'fail: no inbound in 24h', campaign: coll(), contacts: [base[0], base[1]], config: {}, asOf: ASOF, tier1: { history: { 'phone:+919812340001': [{ kind: 'inbound', channel: 'whatsapp', occurredAt: '2026-09-14T09:00:00+05:30', source: 'connector:wati' }] } }, expect: { status: 'fail', severity: 'block', affected: ['c02'] } },
    { name: 'not applicable: sms', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-WA-002': [
    { name: 'not applicable: no template', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
    { name: 'cannot: no platform templates + no externalId', campaign: coll({ template: { body: 'Hi {{1}}', variables: ['x'] } }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['campaign.template.externalId', 'platform.templates'] } },
    { name: 'fail: template PENDING', campaign: coll({ template: { body: 'Hi {{1}}', variables: ['x'], externalId: 'emi_due' } }), contacts: base, config: {}, asOf: ASOF, tier1: { platform: { templates: [{ externalId: 'emi_due', name: 'emi_due', status: 'PENDING', category: 'UTILITY', body: 'Hi {{1}}', variableCount: 1 }] } }, expect: { status: 'fail', severity: 'block' } },
    { name: 'fail: category mismatch', campaign: promo({ channel: 'whatsapp', template: { body: 'Offer {{1}}', variables: ['x'], externalId: 'offer' } }), contacts: base, config: {}, asOf: ASOF, tier1: { platform: { templates: [{ externalId: 'offer', name: 'offer', status: 'APPROVED', category: 'UTILITY', body: 'Offer {{1}}', variableCount: 1 }] } }, expect: { status: 'fail' } },
    { name: 'pass', campaign: coll({ template: { body: 'Hi {{1}}', variables: ['x'], externalId: 'emi_due' } }), contacts: base, config: {}, asOf: ASOF, tier1: { platform: { templates: [{ externalId: 'emi_due', name: 'emi_due', status: 'APPROVED', category: 'UTILITY', body: 'Hi {{1}}', variableCount: 1 }] } }, expect: { status: 'pass' } },
  ],
  'A-WA-003': [
    { name: 'fail: 3 placeholders, 2 variables', campaign: coll({ template: { body: 'Rs {{1}} since {{2}}. Pay: {{3}}', variables: ['8,450', '28 Aug'] } }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'block', affected: [] } },
    { name: 'fail: non-contiguous', campaign: coll({ template: { body: 'Hi {{1}}, due {{3}}.', variables: ['a', 'b'] } }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'fail' } },
    { name: 'pass', campaign: coll({ template: { body: 'Hi {{1}}, your EMI of {{2}} is due.', variables: ['Ravi', '5000'] } }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
    { name: 'cannot: no template', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['campaign.template.body'] } },
    { name: 'not applicable: sms', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-WA-004': [
    { name: 'cannot: no platform', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['platform.messagingLimit'] } },
    { name: 'fail: 3 > TIER_250? no — use audience 300', campaign: coll(), contacts: base, audience: { rows: 300, duplicates: [], unresolvable: [] }, config: {}, asOf: ASOF, tier1: { platform: { messagingLimitTier: 'TIER_250' } }, expect: { status: 'fail', severity: 'warn' } },
    { name: 'pass', campaign: coll(), contacts: base, config: {}, asOf: ASOF, tier1: { platform: { messagingLimitTier: 'TIER_1K' } }, expect: { status: 'pass' } },
    { name: 'not applicable: sms', campaign: promo(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-WA-005': [
    { name: 'cannot', campaign: promo({ channel: 'whatsapp' }), contacts: base, config: {}, asOf: ASOF, expect: { status: 'cannot_evaluate', missing: ['platform.qualityRating'] } },
    { name: 'fail: RED', campaign: promo({ channel: 'whatsapp' }), contacts: base, config: {}, asOf: ASOF, tier1: { platform: { qualityRating: 'RED' } }, expect: { status: 'fail', severity: 'warn' } },
    { name: 'pass: GREEN', campaign: promo({ channel: 'whatsapp' }), contacts: base, config: {}, asOf: ASOF, tier1: { platform: { qualityRating: 'GREEN' } }, expect: { status: 'pass' } },
    { name: 'cannot: UNKNOWN never passes', campaign: promo({ channel: 'whatsapp' }), contacts: base, config: {}, asOf: ASOF, tier1: { platform: { qualityRating: 'UNKNOWN' } }, expect: { status: 'cannot_evaluate' } },
    { name: 'not applicable: collections', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'not_applicable' } },
  ],
  'A-PF-001': [
    { name: 'fail: 2 duplicates', campaign: coll(), contacts: base, audience: { rows: 5, duplicates: [{ rowId: 'c04', duplicateOf: 'c01' }, { rowId: 'c05', duplicateOf: 'c01' }], unresolvable: [] }, config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'warn', affected: ['c04', 'c05'] } },
    { name: 'pass', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
  ],
  'A-PF-002': [
    { name: 'fail: conflict + later withdrawal', campaign: coll(), contacts: [C('c01', { consentSource: 'upload:conflict' }), C('c02', { consentSource: 'records:later-withdrawal' }), C('c03', { consentSource: 'upload' })], config: {}, asOf: ASOF, expect: { status: 'fail', severity: 'warn', affected: ['c01', 'c02'] } },
    { name: 'pass', campaign: coll(), contacts: base, config: {}, asOf: ASOF, expect: { status: 'pass' } },
  ],
};

for (const [ruleId, cases] of Object.entries(fixtures)) {
  writeFileSync(join(out, `${ruleId}.json`), JSON.stringify({ ruleId, cases }, null, 2) + '\n');
}
console.log('wrote', Object.keys(fixtures).length, 'fixture files');
