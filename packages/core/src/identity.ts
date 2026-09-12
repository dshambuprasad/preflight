// Identity key (05 §3, D11, D26/D48). Exact match only; no fuzzy matching in v1.

import type { IdentityKind } from './types.js';
import { missing } from './util.js';

export const DEFAULT_IDENTITY_PRECEDENCE: readonly IdentityKind[] = ['externalId', 'phone', 'email'];

export interface Identifiers {
  externalId?: string | null;
  phoneE164?: string | null;
  emailNorm?: string | null;
}

/**
 * `ext:<externalId>` | `phone:<E.164>` | `email:<normalised>` | `row:<rowId>` (unresolvable; still evaluated).
 * Precedence is tenant-configurable (D26); default externalId → phone → email → row.
 */
export function identityKey(
  ids: Identifiers,
  rowId: string,
  precedence: readonly IdentityKind[] = DEFAULT_IDENTITY_PRECEDENCE,
): string {
  for (const kind of precedence) {
    if (kind === 'externalId' && !missing(ids.externalId)) return 'ext:' + String(ids.externalId).trim();
    if (kind === 'phone' && !missing(ids.phoneE164)) return 'phone:' + ids.phoneE164;
    if (kind === 'email' && !missing(ids.emailNorm)) return 'email:' + ids.emailNorm;
  }
  return 'row:' + rowId;
}

export function isUnresolvable(key: string): boolean {
  return key.startsWith('row:');
}
