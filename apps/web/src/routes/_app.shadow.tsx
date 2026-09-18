import { createFileRoute } from '@tanstack/react-router';
import { M } from '../messages';

export const Route = createFileRoute('/_app/shadow')({
  component: () => (
    <section>
      <h1 className="text-xl">{M.nav.shadow}</h1>
      <p className="mt-2 text-ink-muted">{M.placeholders.shadow}</p>
    </section>
  ),
});
