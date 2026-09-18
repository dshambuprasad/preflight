import { createFileRoute } from '@tanstack/react-router';
import { NewCheck } from '../components/NewCheck';

export const Route = createFileRoute('/_app/campaigns/new')({ component: () => <NewCheck /> });
