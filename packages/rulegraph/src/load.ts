// Turtle → our own graph structure. N3 parses; we walk (04 §7: no reasoner).
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Parser, Writer, type Quad } from 'n3';
import type { Citation, RulePack, Severity, SourceConfidence } from '@preflight/core';
import type {
  ClauseInfo, EnforcementInfo, ExplainPath, GraphEdge, GraphNode, InstrumentInfo, RegulatorInfo, RuleGraph, RuleMeta,
  ValidationReport,
} from './types.js';

const PF = 'https://preflight.dev/ns/pf#';
const BASE = 'https://preflight.dev/';
const PROV = 'http://www.w3.org/ns/prov#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const DCTERMS = 'http://purl.org/dc/terms/';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const SHORT: [string, string][] = [
  [BASE + 'rule/', 'rule:'],
  [BASE + 'instrument/', 'inst:'],
  [BASE + 'clause/', 'clause:'],
  [BASE + 'regulator/', 'reg:'],
  [BASE + 'enforcement/', 'enf:'],
];

export function shortId(iri: string): string {
  for (const [long, short] of SHORT) if (iri.startsWith(long)) return short + iri.slice(long.length);
  return iri;
}

export class RulebookValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`rulebook validation failed (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n  ${problems.join('\n  ')}`);
    this.name = 'RulebookValidationError';
  }
}

type Props = Map<string, string[]>; // predicate IRI → object values (literal value or IRI)

interface Store {
  types: Map<string, Set<string>>; // subject → rdf:type IRIs
  props: Map<string, Props>;
}

function buildStore(quads: Quad[]): Store {
  const types = new Map<string, Set<string>>();
  const props = new Map<string, Props>();
  for (const q of quads) {
    const s = q.subject.value;
    const p = q.predicate.value;
    const o = q.object.value;
    if (p === RDF_TYPE) {
      if (!types.has(s)) types.set(s, new Set());
      types.get(s)!.add(o);
      continue;
    }
    if (!props.has(s)) props.set(s, new Map());
    const pm = props.get(s)!;
    if (!pm.has(p)) pm.set(p, []);
    pm.get(p)!.push(o);
  }
  return { types, props };
}

function one(store: Store, s: string, p: string): string | null {
  return store.props.get(s)?.get(p)?.[0] ?? null;
}
function many(store: Store, s: string, p: string): string[] {
  return store.props.get(s)?.get(p) ?? [];
}
function subjectsOfType(store: Store, type: string): string[] {
  return [...store.types.entries()].filter(([, t]) => t.has(PF + type)).map(([s]) => s).sort();
}

/** Canonical N-Triples: one line per quad, sorted; the graph content hash (04 §7). */
function canonicalNTriples(quads: Quad[]): string {
  const writer = new Writer({ format: 'N-Triples' });
  const lines = quads.map((q) => writer.quadToString(q.subject, q.predicate, q.object).trim());
  return [...new Set(lines)].sort().join('\n');
}

export async function loadRuleGraph(dir: string): Promise<RuleGraph> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.ttl')).sort();
  if (files.length === 0) throw new RulebookValidationError([`no .ttl files in ${dir}`]);
  const quads: Quad[] = [];
  for (const f of files) {
    const text = await readFile(join(dir, f), 'utf8');
    const parser = new Parser({ format: 'Turtle' });
    try {
      quads.push(...parser.parse(text));
    } catch (err) {
      throw new RulebookValidationError([`${f}: ${err instanceof Error ? err.message : String(err)}`]);
    }
  }
  const hash = createHash('sha256').update(canonicalNTriples(quads)).digest('hex');
  return buildGraph(buildStore(quads), hash, files);
}

function buildGraph(store: Store, hash: string, files: string[]): RuleGraph {
  const regulators = new Map<string, RegulatorInfo>();
  for (const s of subjectsOfType(store, 'Regulator')) {
    regulators.set(shortId(s), {
      id: shortId(s),
      label: one(store, s, RDFS + 'label') ?? shortId(s),
      jurisdiction: one(store, s, PF + 'jurisdiction'),
    });
  }
  const instruments = new Map<string, InstrumentInfo>();
  for (const s of subjectsOfType(store, 'Instrument')) {
    const reg = one(store, s, PROV + 'wasAttributedTo');
    instruments.set(shortId(s), {
      id: shortId(s),
      reference: one(store, s, PF + 'reference') ?? shortId(s),
      title: one(store, s, DCTERMS + 'title') ?? '',
      issued: one(store, s, DCTERMS + 'issued'),
      effectiveFrom: one(store, s, PF + 'effectiveFrom'),
      confidence: (one(store, s, PF + 'sourceConfidence') ?? 'UNVERIFIED') as SourceConfidence,
      url: one(store, s, PF + 'url'),
      scopeNote: one(store, s, PF + 'scopeNote'),
      regulatorId: reg ? shortId(reg) : null,
    });
  }
  const clauses = new Map<string, ClauseInfo>();
  for (const s of subjectsOfType(store, 'Clause')) {
    const inst = one(store, s, PROV + 'wasQuotedFrom');
    clauses.set(shortId(s), {
      id: shortId(s),
      paragraph: one(store, s, PF + 'paragraph'),
      text: one(store, s, PF + 'text'),
      instrumentId: inst ? shortId(inst) : '',
    });
  }
  const enforcement = new Map<string, EnforcementInfo>();
  for (const s of subjectsOfType(store, 'EnforcementAction')) {
    const amount = one(store, s, PF + 'amount');
    enforcement.set(shortId(s), {
      id: shortId(s),
      entity: one(store, s, PF + 'entity') ?? '',
      date: one(store, s, PF + 'date'),
      amount: amount === null ? null : Number(amount),
      summary: one(store, s, PF + 'summary') ?? '',
      url: one(store, s, PF + 'url'),
      evidences: many(store, s, PF + 'evidences').map(shortId),
    });
  }
  const rules = new Map<string, RuleMeta>();
  for (const s of subjectsOfType(store, 'Rule')) {
    const clauseIds = many(store, s, PF + 'derivedFrom').map(shortId);
    const primaryClause = clauseIds[0] ? clauses.get(clauseIds[0]) : undefined;
    const inst = primaryClause ? instruments.get(primaryClause.instrumentId) : undefined;
    const citation: Citation = {
      instrument: inst?.reference ?? '',
      title: inst?.title ?? '',
      confidence: inst?.confidence ?? 'UNVERIFIED',
      graphNodeId: inst?.id ?? '',
      ...(inst?.url ? { url: inst.url } : {}),
    };
    const tier = one(store, s, PF + 'tier');
    const sendTimeCheck = one(store, s, PF + 'sendTimeCheck');
    const id = one(store, s, PF + 'id') ?? shortId(s).replace(/^rule:/, '');
    rules.set(id, {
      id,
      pack: one(store, s, PF + 'pack') ?? '',
      layer: (one(store, s, PF + 'layer') ?? 'A') as RuleMeta['layer'],
      tier: tier === null ? null : (Number(tier) as RuleMeta['tier']),
      category: one(store, s, PF + 'category') as RuleMeta['category'],
      title: one(store, s, PF + 'title') ?? id,
      severity: (one(store, s, PF + 'severity') ?? 'info') as Severity,
      severityBefore: one(store, s, PF + 'severityBefore') as Severity | null,
      effectiveFrom: one(store, s, PF + 'effectiveFrom'),
      requires: many(store, s, PF + 'requires').sort(),
      sendTimeCheck: sendTimeCheck !== 'false',
      severityBasis: one(store, s, PF + 'severityBasis'),
      citation,
      clauseIds,
      supersedes: many(store, s, PF + 'supersedes').map((x) => shortId(x).replace(/^rule:/, '')),
      closeMatch: many(store, s, SKOS + 'closeMatch').map((x) => shortId(x).replace(/^rule:/, '')),
    });
  }

  // ---- nodes/edges in the 06 §7 shape
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  for (const r of [...rules.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const { citation: _c, clauseIds: _cl, supersedes: _s, closeMatch: _m, ...data } = r;
    nodes.push({ id: 'rule:' + r.id, type: 'rule', label: `${r.id} ${r.title}`, data });
    for (const c of r.clauseIds) edges.push({ source: 'rule:' + r.id, target: c, type: 'derivedFrom' });
    for (const o of r.supersedes) edges.push({ source: 'rule:' + r.id, target: 'rule:' + o, type: 'supersedes' });
    for (const o of r.closeMatch) edges.push({ source: 'rule:' + r.id, target: 'rule:' + o, type: 'closeMatch' });
  }
  for (const c of [...clauses.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    nodes.push({ id: c.id, type: 'clause', label: c.paragraph ?? c.id, data: { paragraph: c.paragraph, text: c.text } });
    if (c.instrumentId) edges.push({ source: c.id, target: c.instrumentId, type: 'quotedFrom' });
  }
  for (const i of [...instruments.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const { id, regulatorId, ...data } = i;
    nodes.push({ id, type: 'instrument', label: i.reference, data: { ...data, regulatorId } });
    if (regulatorId) edges.push({ source: id, target: regulatorId, type: 'attributedTo' });
  }
  for (const g of [...regulators.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    nodes.push({ id: g.id, type: 'regulator', label: g.label, data: { jurisdiction: g.jurisdiction } });
  }
  for (const e of [...enforcement.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const { id, evidences, ...data } = e;
    nodes.push({ id, type: 'enforcement', label: `${e.entity} (${e.date ?? 'n.d.'})`, data });
    for (const r of evidences) edges.push({ source: id, target: r, type: 'evidences' });
  }

  const ruleIds = () => [...rules.keys()].sort();

  const explain = (ruleId: string): ExplainPath => {
    const rule = rules.get(ruleId);
    if (!rule) throw new Error(`rule not in graph: ${ruleId}`);
    const cl = rule.clauseIds.map((c) => clauses.get(c)).filter((c): c is ClauseInfo => !!c);
    const instIds = [...new Set(cl.map((c) => c.instrumentId))];
    const ins = instIds.map((i) => instruments.get(i)).filter((i): i is InstrumentInfo => !!i);
    const regIds = [...new Set(ins.map((i) => i.regulatorId).filter((r): r is string => !!r))];
    const regs = regIds.map((r) => regulators.get(r)).filter((r): r is RegulatorInfo => !!r);
    const enf = [...enforcement.values()]
      .filter((e) => e.evidences.includes('rule:' + ruleId))
      .map(({ entity, date, amount, summary, url }) => ({ entity, date, amount, summary, url }));
    const related: ExplainPath['related'] = [];
    const jurisdictionOf = (id: string) => {
      const r = rules.get(id);
      const c = r?.clauseIds[0] ? clauses.get(r.clauseIds[0]) : undefined;
      const i = c ? instruments.get(c.instrumentId) : undefined;
      const g = i?.regulatorId ? regulators.get(i.regulatorId) : undefined;
      return g?.jurisdiction ?? 'IN';
    };
    for (const o of rule.closeMatch) related.push({ ruleId: o, jurisdiction: jurisdictionOf(o), relation: 'closeMatch' });
    for (const o of rule.supersedes) related.push({ ruleId: o, jurisdiction: jurisdictionOf(o), relation: 'supersedes' });
    for (const other of rules.values()) {
      if (other.closeMatch.includes(ruleId) && !rule.closeMatch.includes(other.id))
        related.push({ ruleId: other.id, jurisdiction: jurisdictionOf(other.id), relation: 'closeMatch' });
      if (other.supersedes.includes(ruleId)) related.push({ ruleId: other.id, jurisdiction: jurisdictionOf(other.id), relation: 'supersededBy' });
    }
    return {
      rule,
      path: { clauses: cl, instruments: ins, regulator: regs[0] ?? null, regulators: regs },
      enforcement: enf,
      related,
    };
  };

  const validateAgainst = (packs: RulePack[]): ValidationReport => {
    const problems: string[] = [];
    const code = new Map<string, RulePack['rules'][number]>();
    for (const p of packs) for (const r of p.rules) {
      if (code.has(r.id)) problems.push(`${r.id}: duplicate rule id across packs`);
      code.set(r.id, r);
    }
    for (const r of rules.values()) {
      if (r.clauseIds.length === 0) problems.push(`${r.id}: graph rule has no pf:derivedFrom clause`);
      for (const c of r.clauseIds) {
        const clause = clauses.get(c);
        if (!clause) { problems.push(`${r.id}: derivedFrom ${c} is not a pf:Clause`); continue; }
        const inst = instruments.get(clause.instrumentId);
        if (!inst) { problems.push(`${c}: clause has no pf:Instrument (prov:wasQuotedFrom)`); continue; }
        if (!inst.regulatorId || !regulators.has(inst.regulatorId)) problems.push(`${inst.id}: instrument has no pf:Regulator (prov:wasAttributedTo)`);
        if (!['PRIMARY', 'SECONDARY', 'DERIVED', 'PLATFORM', 'UNVERIFIED'].includes(inst.confidence)) problems.push(`${inst.id}: instrument has no valid pf:sourceConfidence`);
      }
      const impl = code.get(r.id);
      if (!r.sendTimeCheck) {
        if (impl) problems.push(`${r.id}: marked pf:sendTimeCheck false in the graph but present in pack '${impl.pack}' (D20)`);
        continue;
      }
      if (!impl) { problems.push(`${r.id}: in graph but no code rule in any loaded pack`); continue; }
      if (impl.pack !== r.pack) problems.push(`${r.id}: pack '${impl.pack}' in code, '${r.pack}' in graph`);
      if ((impl.effectiveFrom ?? null) !== r.effectiveFrom) problems.push(`${r.id}: effectiveFrom '${impl.effectiveFrom ?? null}' in code, '${r.effectiveFrom}' in graph`);
      if (impl.severity !== r.severity) problems.push(`${r.id}: severity '${impl.severity}' in code, '${r.severity}' in graph`);
      if ((impl.severityBefore ?? null) !== r.severityBefore) problems.push(`${r.id}: severityBefore '${impl.severityBefore ?? null}' in code, '${r.severityBefore}' in graph`);
      if (r.tier !== null && impl.tier !== r.tier) problems.push(`${r.id}: tier ${impl.tier} in code, ${r.tier} in graph`);
      if (r.category && impl.category !== r.category) problems.push(`${r.id}: category '${impl.category}' in code, '${r.category}' in graph`);
      if (impl.citation.graphNodeId !== r.citation.graphNodeId) problems.push(`${r.id}: citation.graphNodeId '${impl.citation.graphNodeId}' in code, '${r.citation.graphNodeId}' in graph`);
    }
    for (const id of code.keys()) if (!rules.has(id)) problems.push(`${id}: in code but no pf:Rule node in the graph`);
    if (problems.length) throw new RulebookValidationError(problems);
    return { ok: true, problems: [] };
  };

  return { hash, files, nodes, edges, ruleIds, explain, validateAgainst };
}

/** 16 §2.3 — sha256(graph.hash ‖ each pack's sourceHash), packs sorted by id. */
export function rulebookHash(graph: RuleGraph, packs: RulePack[]): string {
  const sorted = [...packs].sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(graph.hash + sorted.map((p) => p.sourceHash).join('')).digest('hex');
}

/** Graph-side rule metadata for `GET /rulebook/rules` and `GET /coverage`. */
export function ruleMetadata(graph: RuleGraph): RuleMeta[] {
  return graph.ruleIds().map((id) => graph.explain(id).rule);
}
