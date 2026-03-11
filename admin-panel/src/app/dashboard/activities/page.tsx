import { Metadata } from 'next';
import { ActivitiesView } from '@/components/views/dashboard/activities';

export const metadata: Metadata = {
  title: 'Activities - Thrive',
  description: 'Review and approve student eco-actions',
};

export default function ActivitiesPage() {
  return <ActivitiesView />;
}
