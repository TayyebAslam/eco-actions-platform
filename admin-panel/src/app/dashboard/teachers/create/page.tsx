import { Metadata } from 'next';
import { TeachersCreateView } from '@/components/views/dashboard/teachers';

export const metadata: Metadata = {
  title: 'Create Teacher - Thrive',
  description: 'Add a new teacher account',
};

export default function CreateTeacherPage() {
  return <TeachersCreateView />;
}
