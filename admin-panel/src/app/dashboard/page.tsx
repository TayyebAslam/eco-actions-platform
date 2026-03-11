import { Metadata } from 'next';
import { DashboardView } from '@/components/views/dashboard/home';

export const metadata: Metadata = {
  title: 'Dashboard - Eco Actions',
  description: 'Admin dashboard for managing your sustainability ecosystem',
};

export default function DashboardPage() {
  return <DashboardView />;
}
