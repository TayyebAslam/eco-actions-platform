import { Metadata } from 'next';
import { DashboardView } from '@/components/views/dashboard/home';

export const metadata: Metadata = {
  title: 'Dashboard - Thrive',
  description: 'Admin dashboard for managing your sustainability ecosystem',
};

export default function DashboardPage() {
  return <DashboardView />;
}
