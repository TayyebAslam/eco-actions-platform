import { Metadata } from 'next';
import { StudentsView } from '@/components/views/dashboard/students';

export const metadata: Metadata = {
  title: 'Students - Thrive',
  description: 'View and manage student profiles',
};

export default function StudentsPage() {
  return <StudentsView />;
}
