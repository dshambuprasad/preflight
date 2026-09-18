import type { Citation, FindingCategory, RuleLayer, RulePack, RuleTier, Severity, SourceConfidence } from '@preflight/core';

export type NodeType = 'rule' | 'clause' | 'instrument' | 'regulator' | 'enforcement';
export type EdgeType = 'derivedFrom' | 'quotedFrom' | 'attributedTo' | 'evidences' | 'supersedes' | 'closeMatch';

export interface GraphNode {
  id: string; // short form: rule:A-RBI-001, inst:RBI-2022-23-108, clause:RBI-2026-27-115/85L, reg:RBI, enf:HDFC-2024
  type: NodeType;
  label: string;
  data: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
}

export interface ClauseInfo {
  id: string;
  paragraph: string | null;
  text: string | null;
  instrumentId: string;
}

export interface InstrumentInfo {
  id: string;
  reference: string;
  title: string;
  issued: string | null;
  effectiveFrom: string | null;
  confidence: SourceConfidence;
  url: string | null;
  scopeNote: string | null;
  regulatorId: string | null;
}

export interface RegulatorInfo {
  id: string;
  label: string;
  jurisdiction: string | null;
}

export interface EnforcementInfo {
  id: string;
  entity: string;
  date: string | null;
  amount: number | null;
  summary: string;
  url: string | null;
  evidences: string[];
}

/** 06 §7 `GET /rulebook/rules` item; also the graph side of parity validation. */
export interface RuleMeta {
  id: string;
  pack: string;
  layer: RuleLayer;
  tier: RuleTier | null;
  category: FindingCategory | null;
  title: string;
  severity: Severity;
  severityBefore: Severity | null;
  effectiveFrom: string | null;
  requires: string[];
  sendTimeCheck: boolean;
  severityBasis: string | null;
  citation: Citation;
  clauseIds: string[];
  supersedes: string[];
  closeMatch: string[];
}

/** 06 §7 `GET /rulebook/explain/:ruleId` */
export interface ExplainPath {
  rule: RuleMeta;
  path: {
    clauses: ClauseInfo[];
    instruments: InstrumentInfo[];
    regulator: RegulatorInfo | null;
    regulators: RegulatorInfo[];
  };
  enforcement: { entity: string; date: string | null; amount: number | null; summary: string; url: string | null }[];
  related: { ruleId: string; jurisdiction: string; relation: 'closeMatch' | 'supersedes' | 'supersededBy' }[];
}

export interface ValidationReport {
  ok: boolean;
  problems: string[];
}

export interface RuleGraph {
  /** sha256 of the canonical (sorted) N-Triples of every loaded .ttl */
  hash: string;
  files: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  ruleIds(): string[];
  explain(ruleId: string): ExplainPath;
  validateAgainst(packs: RulePack[]): ValidationReport;
}
