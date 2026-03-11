import { Metadata } from 'next';
import { HomeView } from '@/components/views/home';

export const metadata: Metadata = {
  title: 'Thrive - Sustainability Engagement Ecosystem',
  description: 'Gamify eco-friendly actions for schools, teachers, and students. Track sustainability goals and earn rewards.',
  keywords: ['sustainability', 'education', 'gamification', 'eco-friendly', 'schools'],
};

export default function HomePage() {
  return <HomeView />;
}
