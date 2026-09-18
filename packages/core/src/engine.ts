// Preflight — deterministic evaluation core (04 §3). Ported from builds/PreflightCore/src/engine.js.
//
// Side-effect-free by design. `asOf` is injected, never read from the clock, so the same input
// always yields the same report.
//
// The single most important invariant:
//   A rule that could not be evaluated is NEVER reported as a pass.
// It appears in `coverage.cannotEvaluate` and is counted separately. A checker that
// silently passes what it didn't check is worse than no checker.

import type {
  AudienceStats, Contact, Context, CoverageItem, DataPath, EvaluateInput, EvaluationResult, Exception,
  Finding, MessageVariant, Rule, RulePack, Severity, What,
} from './types.js';
import { classify } from './classify.js';
import { DEFAULT_TIMEZONE, localTime, minutesBetween, severityAt } from './time.js';
import { missing, resolvePath, sample } from './util.js';

const SEVERITY_ORDER: Record<Severity, number> = { block: 0, warn: 1, info: 2 };

/** Every DataPath a rule may declare in `requires` (04 §1 invariant 2). */
const KNOWN_PATHS: RegExp[] = [
  /^campaign\.(message|channel|scheduledAt|sendWindowEnd|purpose|borrowerSegment|product|variants)$/,
  /^campaign\.template(\.(body|variables|externalId|category))?$/,
  /^contact\.(externalId|phoneE164|emailNorm|identityKey|preferredLanguage|consentPromotional|consentSource|variantKey)$/,
  /^contact\.attributes\.[A-Za-z0-9_]+$/,
  /^config\.[A-Za-z0-9_.]+$/,
  /^history\.contactEvents$/,
  /^consent\.(current|dnd|productScoped)$/,
  /^platform\.(templates|messagingLimit|qualityRating)$/,
  /^audience\.(duplicates|unresolvable)$/,
];

export function isKnownPath(path: string): boolean {
  return KNOWN_PATHS.some((re) => re.test(path));
}

/**
 * Is the declared dependency ACTUALLY absent from this context? Only absent paths may be
 * reported in `missing[]` (11 §3.2). Listing present fields as missing would send someone
 * hunting for data they already supplied.
 */
export function isAbsent(ctx: Context, path: DataPath): boolean {
  const [head, ...rest] = path.split('.');
  const tail = rest.join('.');
  switch (head) {
    case 'campaign':
      return missing(resolvePath(ctx.campaign, tail));
    case 'config':
      return missing(resolvePath(ctx.config, tail));
    case 'contact':
      return !ctx.contacts.some((c) => !missing(resolvePath(c, tail)));
    case 'history':
      return !ctx.history;
    case 'consent':
      if (!ctx.consent) return true;
      if (tail === 'dnd') return typeof ctx.consent.dnd !== 'function';
      if (tail === 'productScoped') return !ctx.consent.productScoped;
      return false;
    case 'platform':
      if (!ctx.platform) return true;
      if (tail === 'templates') return ctx.platform.templates == null;
      if (tail === 'messagingLimit') return missing(ctx.platform.messagingLimitTier);
      if (tail === 'qualityRating') return missing(ctx.platform.qualityRating);
      return true;
    case 'audience':
      return false;
    default:
      return true;
  }
}

export class PackValidationError extends Error {
  constructor(message: string, readonly problems: string[]) {
    super(message);
    this.name = 'PackValidationError';
  }
}

/** Validates packs at load: unique ids, known `requires`, severities, citations. Throws on failure. */
export function validatePacks(packs: readonly RulePack[]): void {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const pack of packs) {
    if (!pack.id) problems.push('pack without id');
    for (const rule of pack.rules) {
      if (seen.has(rule.id)) problems.push(`${rule.id}: duplicate rule id`);
      seen.add(rule.id);
      if (rule.pack !== pack.id) problems.push(`${rule.id}: rule.pack '${rule.pack}' ≠ pack '${pack.id}'`);
      if (!['block', 'warn', 'info'].includes(rule.severity)) problems.push(`${rule.id}: bad severity`);
      if (rule.severityBefore && !['block', 'warn', 'info'].includes(rule.severityBefore)) problems.push(`${rule.id}: bad severityBefore`);
      if (rule.effectiveFrom && !/^\d{4}-\d{2}-\d{2}$/.test(rule.effectiveFrom)) problems.push(`${rule.id}: effectiveFrom must be YYYY-MM-DD`);
      if (!rule.citation?.instrument || !rule.citation?.confidence || !rule.citation?.graphNodeId) problems.push(`${rule.id}: citation incomplete`);
      if (!Array.isArray(rule.requires) || rule.requires.length === 0) problems.push(`${rule.id}: must declare requires[]`);
      for (const p of rule.requires ?? []) if (!isKnownPath(p)) problems.push(`${rule.id}: unknown requires path '${p}'`);
      if (typeof rule.explain !== 'function') problems.push(`${rule.id}: explain() is required (12 §H D43)`);
      if (typeof rule.appliesTo !== 'function' || typeof rule.evaluate !== 'function') problems.push(`${rule.id}: appliesTo/evaluate required`);
    }
  }
  if (problems.length) throw new PackValidationError(`rule pack validation failed:\n  ${problems.join('\n  ')}`, problems);
}

function isPerVariant(rule: Rule): boolean {
  return rule.perVariant ?? rule.category === 'content';
}

type Outcome =
  | { kind: 'cannot'; missing: DataPath[]; reason: string }
  | { kind: 'na'; reason?: string }
  | { kind: 'evaluated'; finding: Finding | null };

function activeException(exceptions: readonly Exception[], ruleId: string, asOf: string): Exception | null {
  const t = Date.parse(asOf);
  for (const e of exceptions) {
    if (e.ruleId !== ruleId) continue;
    const exp = Date.parse(e.expiresAt);
    if (Number.isNaN(exp) || exp <= t) continue; // expired exceptions are ignored (D13)
    return e;
  }
  return null;
}

function defaultWhat(affected: readonly string[]): What {
  return affected.length ? { kind: 'rows' } : { kind: 'message_text' };
}

function runRule(rule: Rule, ctx: Context): Outcome {
  const applicability = rule.appliesTo(ctx);
  if (applicability === 'unknown') {
    return {
      kind: 'cannot',
      reason: 'cannot tell whether this rule applies',
      // Only report dependencies that are ACTUALLY absent (04 §3: campaign.* requires).
      missing: rule.requires.filter((p) => p.startsWith('campaign.') && isAbsent(ctx, p)),
    };
  }
  if (applicability === false) return { kind: 'na' };

  const result = rule.evaluate(ctx);
  if (result.status === 'cannot_evaluate') {
    return {
      kind: 'cannot',
      reason: result.reason ?? 'required data not present',
      // Rules own their missing[] (a present-but-unparseable value is still unusable); fixtures assert it exactly.
      missing: [...result.missing],
    };
  }
  if (result.status === 'not_applicable') return { kind: 'na', reason: result.reason };
  if (result.status === 'pass') return { kind: 'evaluated', finding: null };

  const affected = result.affected ?? [];
  let severity = severityAt(rule, ctx.asOf);
  let suppressedBy: string | null = null;
  const exception = activeException(ctx.exceptions, rule.id, ctx.asOf);
  if (exception) {
    severity = 'info'; // downgraded, never removed (D13)
    suppressedBy = exception.id;
  }
  const finding: Finding = {
    ruleId: rule.id,
    severity,
    title: rule.title,
    citation: rule.citation,
    note: rule.note,
    affectedCount: affected.length,
    affectedSample: sample(affected),
    detail: result.detail ?? {},
    explanation: rule.explain(ctx, result),
    category: rule.category,
    what: result.what ?? defaultWhat(affected),
    suggestedFix: rule.suggestFix ? (rule.suggestFix(ctx, result) ?? null) : null,
    affectedRowIds: [...affected],
    variantKey: ctx.variant.key,
    suppressedBy,
  };
  return { kind: 'evaluated', finding };
}

function variantsOf(input: EvaluateInput): MessageVariant[] {
  const declared = input.campaign.variants ?? [];
  if (declared.length === 0) {
    return [{ key: 'default', message: input.campaign.message, template: input.campaign.template ?? null }];
  }
  return declared.map((v) =>
    v.key === 'default' && v.template === undefined ? { ...v, template: input.campaign.template ?? null } : v,
  );
}

function contactsByVariant(contacts: readonly Contact[], variants: readonly MessageVariant[]): Map<string, Contact[]> {
  const keys = new Set(variants.map((v) => v.key));
  const fallback = keys.has('default') ? 'default' : variants[0]!.key;
  const map = new Map<string, Contact[]>();
  for (const v of variants) map.set(v.key, []);
  for (const c of contacts) {
    const k = c.variantKey && keys.has(c.variantKey) ? c.variantKey : fallback;
    map.get(k)!.push(c);
  }
  return map;
}

export function evaluate(input: EvaluateInput): EvaluationResult {
  const { campaign, contacts = [], config = {}, asOf, packs } = input;
  if (!campaign || typeof campaign !== 'object') throw new Error('campaign is required');
  if (missing(asOf)) throw new Error('asOf (ISO instant) is required — the core never reads the clock');
  if (!Array.isArray(packs)) throw new Error('packs[] is required');
  validatePacks(packs);

  const normalised: Contact[] = contacts.map((c, i) => ({ ...c, id: c.id ?? `row-${i + 1}` }));
  const classification = classify(campaign.message, config.classificationMarkers ?? {});
  // An explicitly declared purpose always wins over inference.
  const effectivePurpose = missing(campaign.purpose) ? classification.evaluateAs : (campaign.purpose as Context['effectivePurpose']);
  const timezone = config.timezone || DEFAULT_TIMEZONE;
  const local = localTime(campaign.scheduledAt, timezone);
  const localEnd = missing(campaign.sendWindowEnd) ? null : localTime(campaign.sendWindowEnd, timezone);
  const sendWindowMinutes = missing(campaign.sendWindowEnd) ? 0 : minutesBetween(campaign.scheduledAt, campaign.sendWindowEnd);
  const audience: AudienceStats = input.audience ?? { rows: normalised.length, duplicates: [], unresolvable: [] };
  const exceptions = input.exceptions ?? [];

  const variants = variantsOf(input);
  const grouped = contactsByVariant(normalised, variants);
  const base: Omit<Context, 'variant' | 'contacts' | 'campaign'> = {
    config, asOf, classification, effectivePurpose, timezone, local, localEnd, sendWindowMinutes, audience,
    history: input.history, consent: input.consent, platform: input.platform, exceptions,
  };
  const defaultVariant = variants.find((v) => v.key === 'default') ?? variants[0]!;
  const wholeCtx: Context = { ...base, campaign, contacts: normalised, variant: defaultVariant };
  const variantCtxs: Context[] = variants
    .filter((v) => variants.length === 1 || (grouped.get(v.key)?.length ?? 0) > 0)
    .map((v) => ({
      ...base,
      campaign: { ...campaign, message: v.message, template: v.template ?? null },
      contacts: grouped.get(v.key) ?? [],
      variant: v,
    }));

  const rules = packs.flatMap((p) => p.rules).sort((a, b) => a.id.localeCompare(b.id));
  const findings: Finding[] = [];
  const cannotEvaluate: CoverageItem[] = [];
  const notApplicable: { ruleId: string; title: string; reason?: string }[] = [];
  const ruleErrors: { ruleId: string; error: string }[] = [];
  let evaluated = 0;

  for (const rule of rules) {
    const ctxs = isPerVariant(rule) ? variantCtxs : [wholeCtx];
    const outcomes: Outcome[] = [];
    for (const ctx of ctxs) {
      try {
        outcomes.push(runRule(rule, ctx));
      } catch (err) {
        // 14 §3: one rule's bug never stops the others, and never becomes a pass.
        const message = err instanceof Error ? err.message : String(err);
        ruleErrors.push({ ruleId: rule.id, error: message });
        outcomes.push({ kind: 'cannot', reason: 'rule-error', missing: [] });
      }
    }
    const cannot = outcomes.filter((o): o is Extract<Outcome, { kind: 'cannot' }> => o.kind === 'cannot');
    const evald = outcomes.filter((o): o is Extract<Outcome, { kind: 'evaluated' }> => o.kind === 'evaluated');
    for (const o of evald) if (o.finding) findings.push(o.finding); // a found problem is never hidden
    if (cannot.length) {
      cannotEvaluate.push({
        ruleId: rule.id,
        title: rule.title,
        reason: cannot[0]!.reason,
        missing: [...new Set(cannot.flatMap((c) => c.missing))],
      });
    } else if (evald.length) {
      evaluated++;
    } else {
      const first = outcomes[0] as Extract<Outcome, { kind: 'na' }> | undefined;
      const item: { ruleId: string; title: string; reason?: string } = { ruleId: rule.id, title: rule.title };
      if (first?.reason !== undefined) item.reason = first.reason;
      notApplicable.push(item);
    }
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.variantKey.localeCompare(b.variantKey),
  );

  const applicable = evaluated + cannotEvaluate.length;
  const unresolvable = audience.unresolvable.length;
  const statement =
    (applicable === 0
      ? 'No rules were applicable to this campaign.'
      : `Checked ${evaluated} of ${applicable} applicable rules.` +
        (cannotEvaluate.length
          ? ` ${cannotEvaluate.length} could not be evaluated — ${
              [...new Set(cannotEvaluate.flatMap((c) => c.missing))].join(', ') || 'insufficient data'
            }.`
          : '')) +
    (unresolvable
      ? ` ${unresolvable} recipient${unresolvable === 1 ? '' : 's'} had no phone or email and could not be matched to history or consent.`
      : '');

  return {
    findings,
    classification,
    effectivePurpose,
    coverage: { rulesInBook: rules.length, applicable, evaluated, cannotEvaluate, notApplicable, statement },
    summary: {
      blockers: findings.filter((f) => f.severity === 'block').length,
      warnings: findings.filter((f) => f.severity === 'warn').length,
      info: findings.filter((f) => f.severity === 'info').length,
      cannotEvaluate: cannotEvaluate.length,
      audienceSize: normalised.length,
      // Deliberately NOT a "compliant / not compliant" verdict (01 §7, 04 §3).
      verdict: null,
    },
    variants: variants.map((v) => ({ key: v.key, recipientCount: grouped.get(v.key)?.length ?? 0 })),
    ruleErrors,
  };
}
