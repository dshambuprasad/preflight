import { createFileRoute } from '@tanstack/react-router';
import { M } from '../messages';

export const Route = createFileRoute('/_app/rulebook')({
  component: () => (
    <section>
      <h1 className="text-xl">{M.nav.rulebook}</h1>
      <p className="mt-2 text-ink-muted">{M.placeholders.rulebook}</p>
    </section>
  ),
});
