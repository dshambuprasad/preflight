import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function renderUi(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Tooltip.Provider>{ui}</Tooltip.Provider>
    </QueryClientProvider>,
  );
}

/** Tiny fetch mock: exact path → JSON body (+ status). */
export function mockFetch(handlers: Record<string, { status?: number; body: unknown }>) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, 'http://localhost').pathname;
    const h = handlers[path];
    if (!h) return new Response(JSON.stringify({ type: 'https://preflight.dev/errors/not-found', title: 'Not found', status: 404, instance: path, requestId: 'r' }), { status: 404, headers: { 'content-type': 'application/problem+json' } });
    return new Response(JSON.stringify(h.body), { status: h.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

export const FINDING = {
  id: 'f1', evaluationId: 'e1', ruleId: 'A-RBI-001', severity: 'block' as const, category: 'timing' as const,
  title: 'Recovery contact only between 08:00 and 19:00 IST',
  explanation: 'Scheduled for 20:15 IST — outside the permitted 08:00–19:00 recovery window. All 12 recipients affected. The restriction covers messages, not just calls.',
  what: { kind: 'schedule' as const, field: 'scheduledAt', excerpt: '20:15 IST' },
  suggestedFix: { kind: 'reschedule' as const, label: 'Reschedule to 09:00 IST tomorrow', payload: {} },
  affectedCount: 12, affectedSample: ['row-1', 'row-2'], affectedRowsTruncated: false,
  citation: { instrument: 'RBI/2022-23/108, DOR.ORG.REC.65/21.04.158/2022-23 (12 Aug 2022)', title: 'Outsourcing…', confidence: 'SECONDARY' as const, graphNodeId: 'inst:RBI-2022-23-108' },
  suppressedBy: null, variantKey: 'default', decisions: [],
};
