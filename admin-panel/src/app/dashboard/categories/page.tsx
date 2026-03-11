import { Metadata } from 'next';
import { CategoriesView } from '@/components/views/dashboard/categories';

export const metadata: Metadata = {
  title: 'Categories - Thrive',
  description: 'Manage activity categories for eco-actions',
};

export default function CategoriesPage() {
  return <CategoriesView />;
}
