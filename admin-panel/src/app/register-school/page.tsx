import { Metadata } from 'next';
import { RegisterSchoolView } from '@/components/views/register-school';

export const metadata: Metadata = {
  title: 'Register School - Eco Actions',
  description: 'Register your school with Eco Actions and start empowering students to make a positive environmental impact',
};

export default function RegisterSchoolPage() {
  return <RegisterSchoolView />;
}
