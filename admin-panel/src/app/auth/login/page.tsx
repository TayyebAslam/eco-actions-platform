import { Metadata } from 'next';
import { LoginView } from '@/components/views/auth/login';

export const metadata: Metadata = {
  title: 'Login - Eco Actions',
  description: 'Sign in to your Eco Actions admin dashboard and manage your sustainability ecosystem',
  robots: 'noindex, nofollow', // Prevent indexing of login page
};

export default function LoginPage() {
  return <LoginView />;
}
