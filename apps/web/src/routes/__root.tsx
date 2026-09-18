import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { M } from '../messages';

/** S-02 — not found. */
function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-xl">{M.errors.notFound}</h1>
      <p className="text-ink-muted">404</p>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});
