import { Metadata } from 'next';
import { SchoolRequestsView } from '@/components/views/dashboard/school-requests';

export const metadata: Metadata = {
  title: 'School Requests - Thrive',
  description: 'Review and manage school registration requests',
};

export default function SchoolRequestsPage() {
  return <SchoolRequestsView />;
}
