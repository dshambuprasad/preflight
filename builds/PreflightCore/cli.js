#!/usr/bin/env node
// Usage: node cli.js sample/collections_campaign.json sample/contacts.csv [nowISO]
//
// Thin I/O shell around the pure core — the core itself never touches the filesystem.

import { readFileSync } from 'node:fs';
import { evaluate } from './src/engine.js';
import { parseCSV } from './src/util.js';

const [, , campaignPath, contactsPath, nowArg] = process.argv;
if (!campaignPath || !contactsPath) {
  console.error('usage: node cli.js <campaign.json> <contacts.csv> [nowISO]');
  process.exit(2);
}

const input = JSON.parse(readFileSync(campaignPath, 'utf8'));
const contacts = parseCSV(readFileSync(contactsPath, 'utf8'));
const now = nowArg ?? new Date().toISOString(); // the SHELL reads the clock, not the core

const r = evaluate({ campaign: input.campaign, contacts, config: input.config ?? {}, now });

const ICON = { block: '✖ BLOCK', warn: '⚠ WARN ', info: 'ℹ INFO ' };
const line = '─'.repeat(72);

console.log(`\n${line}\nPREFLIGHT REPORT`);
console.log(`Campaign : ${input.campaign.channel} · ${r.summary.audienceSize} recipients · scheduled ${input.campaign.scheduledAt}`);
console.log(`Purpose  : ${r.effectivePurpose} (${r.classification.classification}, confidence ${r.classification.confidence})`);
if (r.classification.confidence === 'low') console.log(`           ↳ ${r.classification.reason}`);
console.log(`Evaluated: ${now}\n${line}\n`);

if (!r.findings.length) console.log('No findings.\n');
for (const f of r.findings) {
  console.log(`${ICON[f.severity]}  ${f.ruleId} — ${f.title}`);
  console.log(`   ${f.explanation}`);
  if (f.affectedCount) {
    console.log(`   Affected: ${f.affectedCount} — e.g. ${f.affectedSample.join(', ')}`);
  }
  console.log(`   Basis: ${f.citation.instrument}`);
  console.log(`   Source confidence: ${f.citation.confidence}\n`);
}

console.log(line);
console.log(`COVERAGE: ${r.coverage.statement}`);
for (const c of r.coverage.cannotEvaluate) {
  console.log(`   – ${c.ruleId} ${c.title}\n     needs: ${(c.missing ?? []).join(', ') || c.reason}`);
}
console.log(`\n${r.summary.blockers} blocker(s), ${r.summary.warnings} warning(s), ${r.summary.info} info, ${r.summary.cannotEvaluate} unevaluated.`);
console.log('This report finds gaps for human review. It does not certify compliance.');
console.log(line + '\n');

process.exitCode = r.summary.blockers > 0 ? 1 : 0;
