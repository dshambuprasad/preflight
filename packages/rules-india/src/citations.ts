// Instrument constants — `instrument`/`title` exactly as rulebook/README.md (they are the graph's
// pf:reference / dcterms:title and, for the 9 ported rules, byte-identical to PreflightCore).
import type { Citation } from '@preflight/core';

export const RBI_RECOVERY_2022: Citation = {
  instrument: 'RBI/2022-23/108, DOR.ORG.REC.65/21.04.158/2022-23 (12 Aug 2022)',
  title: 'Outsourcing of Financial Services – Responsibilities of REs employing Recovery Agents',
  confidence: 'SECONDARY',
  graphNodeId: 'inst:RBI-2022-23-108',
};

export const RBI_RBC_2026: Citation = {
  instrument: 'RBI/2026-27/115, DOR.MCS.REC.No.94/01-01-032/2026-27 (15 Jun 2026)',
  title: 'RBI (Commercial Banks – Responsible Business Conduct) Second Amendment Directions, 2026 — effective 1 Jan 2027',
  confidence: 'PRIMARY',
  graphNodeId: 'inst:RBI-2026-27-115',
};

/** A-IN-003 cites 85L as the reason classification matters; the gate itself is a product derivation. */
export const RBI_RBC_2026_DERIVED: Citation = { ...RBI_RBC_2026, confidence: 'DERIVED' };

export const RBI_FPC: Citation = {
  instrument: 'RBI (NBFC – Responsible Business Conduct) Directions, 2025',
  title: 'Fair Practices Code',
  confidence: 'DERIVED',
  graphNodeId: 'inst:RBI-NBFC-RBC-2025',
};

export const RBI_DLD_2025: Citation = {
  instrument: 'RBI Digital Lending Directions, 2025',
  title: 'Digital Lending Directions',
  confidence: 'SECONDARY',
  graphNodeId: 'inst:RBI-DLD-2025',
};

export const TRAI_TCCCPR_2018: Citation = {
  instrument: 'TRAI Telecom Commercial Communications Customer Preference Regulations, 2018',
  title: 'TCCCPR 2018 (DLT registration, DND/NCPR)',
  confidence: 'SECONDARY',
  graphNodeId: 'inst:TRAI-TCCCPR-2018',
};

export const DPDP_2023: Citation = {
  instrument: 'Digital Personal Data Protection Act, 2023',
  title: 'DPDP Act — purpose limitation and consent (ss. 6–7); ordinary fiduciaries from 13 May 2027',
  confidence: 'SECONDARY',
  graphNodeId: 'inst:DPDP-2023',
};

export const META_WA: Citation = {
  instrument: 'WhatsApp Business Platform policy (Meta)',
  title: 'Message template specification',
  confidence: 'PLATFORM',
  graphNodeId: 'inst:META-WA-POLICY',
};

export const PREFLIGHT_HYGIENE: Citation = {
  instrument: 'Preflight audience-hygiene rule',
  title: 'Product rule — data quality of the audience, not a legal obligation',
  confidence: 'DERIVED',
  graphNodeId: 'inst:PREFLIGHT-HYGIENE',
};
