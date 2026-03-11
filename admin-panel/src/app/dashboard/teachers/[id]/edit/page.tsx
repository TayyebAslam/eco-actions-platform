import { Metadata } from 'next';
import { TeacherFormView } from '@/components/views/dashboard/teachers';

export const metadata: Metadata = {
  title: 'Edit Teacher - Eco Actions',
  description: 'Edit teacher details',
};

export default function EditTeacherPage() {
  return <TeacherFormView />;
}
