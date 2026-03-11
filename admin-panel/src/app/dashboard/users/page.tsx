import { Metadata } from 'next';
import { UsersView } from '@/components/views/dashboard/users';

export const metadata: Metadata = {
  title: 'Users - Thrive',
  description: 'Manage all system users',
};

export default function UsersPage() {
  return <UsersView />;
}
