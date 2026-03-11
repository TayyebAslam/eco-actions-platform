import { Metadata } from 'next';
import { SchoolsView } from '@/components/views/dashboard/schools';

export const metadata: Metadata = {
  title: 'Schools - Eco Actions',
  description: 'Manage schools in your sustainability ecosystem',
};

export default function SchoolsPage() {
  return <SchoolsView />;
}
