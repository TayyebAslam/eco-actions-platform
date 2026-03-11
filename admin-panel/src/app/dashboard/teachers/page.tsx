import { Metadata } from 'next';
import { TeachersView } from '@/components/views/dashboard/teachers';

export const metadata: Metadata = {
  title: 'Teachers - Thrive',
  description: 'Manage teacher accounts and assignments',
};

export default function TeachersPage() {
  return <TeachersView />;
}
