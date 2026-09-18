import { Link, Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { meQuery, useLogout, useMe } from '../hooks/queries';
import { isApiError } from '../api';
import { M } from '../messages';

/** S-01 — the shell. Unauthenticated → /login with the return URL preserved. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(meQuery);
    } catch (e) {
      if (isApiError(e) && e.status === 401) throw redirect({ to: '/login', search: { returnTo: location.href, expired: undefined } });
      throw e;
    }
  },
  component: Shell,
});

const navClass = 'block px-3 py-1.5 hover:bg-paper-2 [&.active]:bg-paper-2 [&.active]:font-semibold';

function Shell() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const roles = me.data?.user.roles ?? [];
  const canReview = roles.some((r) => r === 'reviewer' || r === 'approver' || r === 'admin');
  return (
    <div className="flex min-h-screen">
      <nav className="flex w-44 shrink-0 flex-col border-r border-line bg-white py-3 text-sm">
        <div className="px-3 pb-3 font-serif text-base tracking-widest">{M.product}</div>
        <Link to="/campaigns" className={navClass}>{M.nav.campaigns}</Link>
        <Link to="/campaigns/new" className={navClass}>{M.nav.newCheck}</Link>
        {canReview && <Link to="/review" className={navClass}>{M.nav.review} <span className="chip border-line text-ink-muted">0</span></Link>}
        <Link to="/evidence" className={navClass}>{M.nav.evidence}</Link>
        <Link to="/shadow" className={navClass}>{M.nav.shadow}</Link>
        <Link to="/rulebook" className={navClass}>{M.nav.rulebook}</Link>
        {roles.includes('admin') && (
          <>
            <hr className="my-2 border-line" />
            <Link to="/settings" className={navClass}>{M.nav.settings}</Link>
          </>
        )}
        <div className="mt-auto px-3 pt-3 text-xs">
          <div className="font-semibold">{me.data?.user.displayName}</div>
          <div className="mt-1 flex flex-wrap gap-1">{roles.map((r) => <span key={r} className="chip border-line text-ink-muted">{r}</span>)}</div>
          <button type="button" className="mt-2 underline" onClick={() => logout.mutate(undefined, { onSuccess: () => void navigate({ to: '/login', search: { returnTo: undefined, expired: undefined } }) })}>
            {M.nav.signOut}
          </button>
        </div>
      </nav>
      <div className="min-w-0 flex-1">
        {me.data?.mockConnectors && <div className="bg-warn-bg px-4 py-1 text-center text-xs text-warn">▒▒ {M.ribbon.mock} ▒▒</div>}
        {me.data?.sealingFrozen && <div className="bg-block-bg px-4 py-1 text-xs text-block">■ {M.ribbon.frozen}</div>}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
