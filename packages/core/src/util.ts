// Pure helpers. No DOM, no I/O, no Date.now() — determinism is a hard requirement.

/** True when a value is genuinely absent. Empty string counts as absent. */
export function missing(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/** Deterministic sample of affected ids for the report — sorted, capped. */
export function sample(ids: readonly string[], n = 5): string[] {
  return [...ids].sort().slice(0, n);
}

/** Read a dotted path ("campaign.template.body") off an object. */
export function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

/** Plural helper for explanation text. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
