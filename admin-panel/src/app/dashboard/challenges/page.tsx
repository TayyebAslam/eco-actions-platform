import { Metadata } from 'next';
import { ChallengesView } from '@/components/views/dashboard/challenges';

export const metadata: Metadata = {
  title: 'Challenges - Eco Actions',
  description: 'Create and manage sustainability challenges',
};

export default function ChallengesPage() {
  return <ChallengesView />;
}
