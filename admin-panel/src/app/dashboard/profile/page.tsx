import { Metadata } from 'next';
import { ProfileView } from '@/components/views/dashboard/profile';

export const metadata: Metadata = {
  title: 'Profile Settings - Thrive',
  description: 'Manage your account settings and preferences',
};

export default function ProfilePage() {
  return <ProfileView />;
}
