import { createFileRoute } from '@tanstack/react-router';
import { NewCheck } from '../components/NewCheck';

export const Route = createFileRoute('/_app/campaigns/$id/versions/new')({
  component: () => {
    const { id } = Route.useParams();
    return <NewCheck campaignId={id} />;
  },
});
