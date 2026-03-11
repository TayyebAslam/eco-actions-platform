import { Metadata } from 'next';
import { TeachersView } from '@/components/views/dashboard/teachers';

export const metadata: Metadata = {
  title: 'Teachers - Eco Actions',
  description: 'Manage teacher accounts and assignments',
};

export default function TeachersPage() {
  return <TeachersView />;
}
