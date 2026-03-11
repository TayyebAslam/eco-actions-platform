import { Metadata } from 'next';
import { AdminsCreateView } from '@/components/views/dashboard/admins/create';
import { PermissionActionGuard } from '@/components/guards/PermissionActionGuard';

export const metadata: Metadata = {
  title: 'Create Admin - Thrive',
  description: 'Add a new admin or sub-admin user',
};

export default function CreateAdminPage() {
  return (
    <PermissionActionGuard moduleKey="admins" action="can_create">
      <AdminsCreateView />
    </PermissionActionGuard>
  );
}
