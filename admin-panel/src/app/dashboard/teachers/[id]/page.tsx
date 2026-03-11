import { Metadata } from 'next';
import { TeacherFormView } from '@/components/views/dashboard/teachers';

export const metadata: Metadata = {
  title: 'View Teacher - Eco Actions',
  description: 'View teacher details',
};

export default function ViewTeacherPage() {
  return <TeacherFormView />;
}
