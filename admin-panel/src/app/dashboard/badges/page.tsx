import { Metadata } from 'next';
import { BadgesView } from '@/components/views/dashboard/badges';

export const metadata: Metadata = {
  title: 'Badges - Eco Actions',
  description: 'Manage achievement badges for students',
};

export default function BadgesPage() {
  return <BadgesView />;
}
