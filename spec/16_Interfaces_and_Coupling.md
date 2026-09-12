# 16 — Interfaces & Coupling

The boundaries that keep rework out. Every cross-package call goes through one of the interfaces below; nothing else is imported across a boundary. Enforced by ESLint `no-restricted-imports` per package and a CI dependency-graph check (`pnpm dep-check`, using `dependency-cruiser`).

## 1. Allowed-imports matrix

Row may import column. ✅ allowed · ❌ forbidden · `types` = type-only import.

| from ↓ / to → | core | rules-india | rulegraph | db | api-types | api | web | worker |
|---|---|---|---|---|---|---|---|---|
| **core** | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **rules-india** | ✅ | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **rulegraph** | `types` | `types` | — | ❌ | ❌ | ❌ | ❌ | ❌ |
| **db** | `types` | ❌ | ❌ | — | ❌ | ❌ | ❌ | ❌ |
| **api-types** | `types` | ❌ | ❌ | ❌ | — | ❌ | ❌ | ❌ |
| **api** | ✅ | ✅ | ✅ | ✅ | ✅ | — | ❌ | ❌ |
| **web** | ✅ (browser bundle) | ❌ | ❌ | ❌ | ✅ | ❌ | — | ❌ |
| **worker** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (pipeline/ only) | ❌ | — |

`core` and `rules-*` have **zero runtime npm dependencies**. `web` imports `core` only for the *preview* classification badge in the New-check screen (instant feedback before submit); evaluation always happens server-side.

## 2. Interfaces (full signatures — implement exactly)

### 2.1 `packages/core`

```ts
export interface Rule { /* as 04 §1, verbatim */ }
export interface Context { /* as 04 §2, verbatim */ }

export interface HistoryAccess {
  /** Events for one identity within [from, to). MUST be side-effect free and MAY throw HistoryTimeout. */
  events(identityKey: string, from: ISOInstant, to: ISOInstant): ContactEvent[];
  /** Cheap existence check used by rules to decide cannot_evaluate vs pass. */
  hasAnyHistory(identityKey: string): boolean;
  /** When the tenant's history begins — for cold-start statements. */
  earliestKnown: ISOInstant | null;
}
export interface ConsentAccess {
  current(identityKey: string, purpose: string, channel: Channel | null): ConsentRecord | null;
}
export interface PlatformState {
  qualityRating: 'GREEN'|'YELLOW'|'RED'|'UNKNOWN' | null;
  messagingLimitTier: string | null;
  templates: PlatformTemplate[] | null;
  fetchedAt: ISOInstant;
}
export interface Exception { id: string; ruleId: string; scope: DecisionScope; campaignId?: string; expiresAt: ISOInstant }

export function evaluate(input: {
  campaign: CampaignInput; contacts: Contact[]; config: TenantConfig;
  asOf: ISOInstant; packs: RulePack[]; history?: HistoryAccess; consent?: ConsentAccess;
  platform?: PlatformState; exceptions?: Exception[];
}): EvaluationResult;

export function classify(message: string): Classification;
export function normalisePhone(raw: string, region?: 'IN'): string | null;   // E.164 or null
export function normaliseEmail(raw: string): string | null;
export function identityKey(phoneE164: string|null, emailNorm: string|null, rowId: string): string;
export function canonicalJSON(value: unknown): string;                      // RFC 8785
export function sha256Hex(s: string): string;                               // WebCrypto/Node crypto shim, injected
```
`sha256Hex` and `canonicalJSON` live in core so the **browser can verify a certificate offline** (07 §2.5 Verify button can run client-side against the JSON). The hash implementation is injected via `setCrypto()` at app boot (Node `crypto` or WebCrypto) — core has no import of either.

### 2.2 `packages/rules-india` / any pack

```ts
export interface RulePack {
  id: string;            // 'india-layer-a'
  version: string;       // semver
  rules: Rule[];
  sourceHash: string;    // sha256 of compiled rule sources; computed at build, checked at boot
}
export const pack: RulePack;
```

### 2.3 `packages/rulegraph`

```ts
export interface RuleGraph {
  hash: string;                                   // content hash of all .ttl loaded
  nodes: GraphNode[]; edges: GraphEdge[];
  ruleIds(): string[];
  explain(ruleId: string): ExplainPath;           // rule → clauses → instruments → regulator + enforcement
  validateAgainst(packs: RulePack[]): ValidationReport;   // parity (04 §7); throws on failure
}
export function loadRuleGraph(dir: string): Promise<RuleGraph>;
export function rulebookHash(graph: RuleGraph, packs: RulePack[]): string;  // sha256(graph.hash ‖ packs[].sourceHash)
```

### 2.4 `packages/db`

Every exported query takes `tx: Tx` (transaction or pool) and `tenantId: string` **first**. There are no exported queries without a tenant except `tenants.*`, `rulebookVersions.*`, `jobs.*`.

```ts
export type Tx = DrizzleTx | DrizzlePool;
export const repo = {
  tenants:   { get(tx, id), getBySlug(tx, slug), updateConfig(tx, id, cfg, actor), freezeSealing(tx, id, reason) },
  users:     { list(tx, tenantId), get(tx, tenantId, id), getByEmail(tx, tenantId, email), create(...), setRoles(...) },
  apiKeys:   { create(tx, tenantId, userId, label) → {plaintext}, resolve(tx, plaintext) → {tenantId,userId,roles} | null, revoke(...) },
  campaigns: { create, get, list(tx, tenantId, {cursor,limit,state?}) },
  versions:  { create(tx, tenantId, input) , get, listByCampaign, setState(tx, tenantId, id, from, to) /* CAS: throws InvalidTransition if current≠from */,
               setReviewEvaluation, setProgress, nextVersionNo(tx, tenantId, campaignId) /* advisory lock */ },
  audience:  { insertBatch(tx, tenantId, versionId, rows[]), stream(tx, tenantId, versionId) → AsyncIterable<AudienceRow>, markDuplicates(...), setResolved(...) },
  contacts:  { upsertBatch(tx, tenantId, contacts[]) },
  consent:   { current(tx, tenantId, identityKey, purpose, channel), insert(...), bulkCurrent(tx, tenantId, identityKeys[], purpose, channel) → Map },
  events:    { insertBatch(tx, tenantId, events[]) /* idempotent on (source, external_ref) */, window(tx, tenantId, identityKey, from, to), windowBulk(tx, tenantId, identityKeys[], from, to) → Map<string, ContactEvent[]> /* one query per evaluation — 18 §2.3 */, earliest(tx, tenantId) },
  evaluations: { findExisting(tx, tenantId, versionId, asOf, rulebookHash, exceptionsHash), insertWithFindings(tx, tenantId, evaluation, findings[], coverage[]), get, listByVersion },
  findings:  { get, listByEvaluation },
  decisions: { insert, listByVersion, listByFinding },
  exceptions:{ active(tx, tenantId, campaignId, asOf), insert, expireSweep },
  reviews:   { insert, getByVersion },
  cosign:    { create, findByCode, approve, consumeToken },
  evidence:  { last(tx, tenantId) → {seq, hash} | null, insert(tx, tenantId, record) /* seq = last+1 in same tx */, get, list, walk(tx, tenantId) → AsyncIterable },
  audit:     { insert(tx, tenantId, event) },
  uploads:   { create, get, setMapping, delete },
  connectors:{ list, get, create, update, setStatus, setCursor },
  platform:  { getState, upsertState, upsertTemplates, listTemplates },
  pushes:    { insertBatch, listByVersion, markStatus },
  rulebookVersions: { record(tx, hash, packIds, meta) },
};
```
`versions.setState` is the **only** way state changes; it implements the `05 §2` transition table and throws `InvalidTransition` otherwise. The pipeline never writes `state` directly.

### 2.5 `apps/api` internal seams

```ts
// Storage (uploads, certificates)
export interface Storage {
  put(key: string, stream: Readable, meta: {mime; bytes}): Promise<StorageRef>;
  get(ref: StorageRef): Promise<Readable>;
  delete(ref: StorageRef): Promise<void>;
  signedUrl?(ref: StorageRef, ttlSec: number): Promise<string>;   // s3 only
}
// Jobs
export interface JobQueue {
  enqueue<K extends JobKind>(tx: Tx, kind: K, payload: JobPayload<K>, opts?: {singletonKey?; startAfter?}): Promise<JobId>;
  work<K extends JobKind>(kind: K, handler: (job: Job<K>) => Promise<void>, opts: {concurrency; timeoutMs}): void;
  retry(jobId: JobId): Promise<void>;
}
// Connectors — 08 §1 verbatim, plus:
export interface ConnectorRegistry { get(kind: ConnectorKind): ConnectorFactory; }
export interface ConnectorFactory { create(creds: DecryptedCreds, config: ConnectorConfig): Connector; }
// Crypto for creds
export interface SecretBox { seal(plain: string): {enc: Buffer; iv: Buffer}; open(enc: Buffer, iv: Buffer): string; }
// LLM (M5)
export interface LLMAdapter {
  classify(input: {message: string; heuristic: Classification}): Promise<{classification; confidence: number; rationale: string; provider; model; promptVersion}>;
}
// Clock — used ONLY for TTLs/expiry/audit timestamps in api; never passed into core
export interface Clock { now(): Date }
// Request context
export interface Ctx { tenantId: string; userId: string | null; roles: Role[]; requestId: string; clock: Clock; tx?: Tx }
```

Every stage in `pipeline/stages/*.ts` has the signature `(ctx: Ctx, deps: StageDeps, input: StageInput) => Promise<StageOutput>` where `StageDeps = { repo, queue, storage, connectors, rulebook, clock, logger }`. **Stages never import each other**; the orchestrator (`pipeline/index.ts`) wires them. This is what lets a stage move to a separate worker without change.

### 2.6 `apps/web` ↔ `apps/api`

`packages/api-types` is generated from the Zod schemas (`pnpm gen:types`) and is the **only** contract the web app compiles against. The web app never constructs a URL by hand; it uses the generated client `api.versions.get(id)` etc. Breaking the schema breaks the web build — that's the point.

## 3. Dependency direction (one sentence each)

- **core** knows about nothing.
- **rules** know about core.
- **rulegraph** knows about rule *shapes*, not rule *logic*.
- **db** knows about the schema and nothing about rules or HTTP.
- **api** knows about everything below it and composes it; it contains no rule logic and no SQL outside `db`.
- **web** knows about the API contract and about core's pure helpers for previews and offline verification.

## 4. Where each cross-cutting concern lives (so nobody duplicates it)

| Concern | Lives in | Never in |
|---|---|---|
| Phone/email normalisation | core | api, web (they call core) |
| Canonical JSON + hashing | core (impl injected) | api evidence/ (it calls core) |
| State transitions | db `versions.setState` | pipeline, routes |
| Role checks | api `auth/guard.ts` **and** pipeline stage preconditions | web (UI only mirrors) |
| Tenant scoping | db repo signatures | routes (they pass `ctx.tenantId`) |
| Time `now()` | api `Clock` | core, rules |
| Explanation text | each rule | engine, UI |
| Reason codes | 15 §1 + tenant config | UI constants |
| Error types | api `errors.ts` | scattered strings |
| Redaction paths | api `observability/redact.ts` | ad hoc |

## 5. What must not be coupled (explicit anti-patterns)

- Rules must not read `contacts` by SQL; they receive `Contact[]` and `HistoryAccess`.
- The certificate renderer must not query live tables; it renders `payload`.
- The web app must not compute severity; it displays what the API returns (including `asOf` effects).
- Connectors must not write findings; they write cache tables and events. Only CHECK writes findings.
- The seal job must not recompute an evaluation; it seals the one referenced by `review_evaluation_id`.
