import { createFileRoute } from '@tanstack/react-router';
import { M } from '../messages';

export const Route = createFileRoute('/_app/evidence')({
  component: () => (
    <section>
      <h1 className="text-xl">{M.nav.evidence}</h1>
      <p className="mt-2 text-ink-muted">{M.placeholders.evidence}</p>
    </section>
  ),
});
