import { createFileRoute, redirect } from '@tanstack/react-router';
import { meQuery } from '../hooks/queries';

/** D23 — role-based landing: operator/admin → Campaigns; reviewer/approver → Review queue. */
export const Route = createFileRoute('/_app/')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    const r = me.user.roles;
    if (r.includes('operator') || r.includes('admin')) throw redirect({ to: '/campaigns' });
    throw redirect({ to: '/review' });
  },
});
