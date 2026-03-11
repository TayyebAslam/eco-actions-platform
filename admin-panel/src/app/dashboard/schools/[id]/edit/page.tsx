import { Metadata } from 'next';
import { SchoolFormView } from '@/components/views/dashboard/schools/form';

export const metadata: Metadata = {
  title: 'Edit School - Thrive',
  description: 'Update school information',
};

export default function EditSchoolPage() {
  return <SchoolFormView />;
}
