import { Metadata } from 'next';
import { AdminsEditView } from '@/components/views/dashboard/admins/edit';
import { PermissionActionGuard } from '@/components/guards/PermissionActionGuard';

export const metadata: Metadata = {
  title: 'Edit Admin - Thrive',
  description: 'Update admin account information',
};

export default function EditAdminPage() {
  return (
    <PermissionActionGuard moduleKey="admins" action="can_edit">
      <AdminsEditView />
    </PermissionActionGuard>
  );
}
