import { tenantsRepo } from './tenants.js';
import { apiKeysRepo, usersRepo } from './users.js';
import { campaignsRepo, messageVariantsRepo, versionsRepo } from './campaigns.js';
import { audienceRepo, audienceSetsRepo, uploadsRepo } from './audience.js';
import { consentRepo, contactIdentifiersRepo, contactsRepo, eventsRepo } from './contacts.js';
import { coverageItemsRepo, evaluationsRepo, findingsRepo } from './evaluations.js';
import { decisionsRepo, exceptionsRepo, reviewsRepo, ruleProposalsRepo } from './decisions.js';
import { auditRepo, evidenceRepo } from './evidence.js';
import { connectorsRepo, cosignRepo, idempotencyRepo, platformRepo, pushesRepo, rulebookVersionsRepo } from './ops.js';

/**
 * 16 §2.4 — every helper takes `(tx, tenantId, ...)` first, except `tenants.*`, `rulebookVersions.*` and the
 * credential lookup `apiKeys.findByPrefix`. `versions.setState` is the only writer of `campaign_versions.state`.
 */
export const repo = {
  tenants: tenantsRepo,
  users: usersRepo,
  apiKeys: apiKeysRepo,
  campaigns: campaignsRepo,
  versions: versionsRepo,
  messageVariants: messageVariantsRepo,
  uploads: uploadsRepo,
  audienceSets: audienceSetsRepo,
  audience: audienceRepo,
  contacts: contactsRepo,
  contactIdentifiers: contactIdentifiersRepo,
  consent: consentRepo,
  events: eventsRepo,
  evaluations: evaluationsRepo,
  findings: findingsRepo,
  coverageItems: coverageItemsRepo,
  decisions: decisionsRepo,
  exceptions: exceptionsRepo,
  reviews: reviewsRepo,
  ruleProposals: ruleProposalsRepo,
  evidence: evidenceRepo,
  audit: auditRepo,
  cosign: cosignRepo,
  connectors: connectorsRepo,
  platform: platformRepo,
  pushes: pushesRepo,
  rulebookVersions: rulebookVersionsRepo,
  idempotency: idempotencyRepo,
};

export type Repo = typeof repo;

export * from './tenants.js';
export * from './users.js';
export * from './campaigns.js';
export * from './audience.js';
export * from './contacts.js';
export * from './evaluations.js';
export * from './decisions.js';
export * from './evidence.js';
export * from './ops.js';
export type { Page } from './util.js';
