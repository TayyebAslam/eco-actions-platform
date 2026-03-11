import { Metadata } from 'next';
import { ArticlesView } from '@/components/views/dashboard/articles';

export const metadata: Metadata = {
  title: 'Articles - Thrive',
  description: 'Manage educational content for students',
};

export default function ArticlesPage() {
  return <ArticlesView />;
}
