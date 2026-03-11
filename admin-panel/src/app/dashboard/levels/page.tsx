import { Metadata } from 'next';
import { LevelsView } from '@/components/views/dashboard/levels';

export const metadata: Metadata = {
  title: 'Levels - Eco Actions',
  description: 'Configure XP thresholds for level progression',
};

export default function LevelsPage() {
  return <LevelsView />;
}
