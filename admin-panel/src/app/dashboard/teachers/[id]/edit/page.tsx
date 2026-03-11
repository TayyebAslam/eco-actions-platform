import { Metadata } from 'next';
import { TeacherFormView } from '@/components/views/dashboard/teachers';

export const metadata: Metadata = {
  title: 'Edit Teacher - Thrive',
  description: 'Edit teacher details',
};

export default function EditTeacherPage() {
  return <TeacherFormView />;
}
