import { Metadata } from 'next';
import { UsersView } from '@/components/views/dashboard/users';

export const metadata: Metadata = {
  title: 'Users - Eco Actions',
  description: 'Manage all system users',
};

export default function UsersPage() {
  return <UsersView />;
}
