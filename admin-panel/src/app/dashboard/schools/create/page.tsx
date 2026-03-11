import { Metadata } from 'next';
import { SchoolFormView } from '@/components/views/dashboard/schools/form';

export const metadata: Metadata = {
  title: 'Create School - Thrive',
  description: 'Add a new school to the ecosystem',
};

export default function CreateSchoolPage() {
  return <SchoolFormView />;
}
