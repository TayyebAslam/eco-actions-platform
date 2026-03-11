import { Metadata } from 'next';
import { AdminsView } from '@/components/views/dashboard/admins';
import { PermissionGuard } from '@/components/guards/PermissionGuard';

export const metadata: Metadata = {
  title: 'Admins - Eco Actions',
  description: 'Manage admin and sub-admin users',
};

export default function AdminsPage() {
  return (
    <PermissionGuard moduleKey="admins">
      <AdminsView />
    </PermissionGuard>
  );
}
