import { Metadata } from 'next';
import { SchoolFormView } from '@/components/views/dashboard/schools/form';

export const metadata: Metadata = {
  title: 'School Details - Thrive',
  description: 'View school information',
};

export default function SchoolViewPage() {
  return <SchoolFormView />;
}
