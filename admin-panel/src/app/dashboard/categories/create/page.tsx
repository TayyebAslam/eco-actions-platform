import { Metadata } from "next";
import { CategoryFormView } from "@/components/views/dashboard/categories/form/CategoryFormView";

export const metadata: Metadata = {
  title: "Create Category - Eco Actions",
  description: "Create a new category for activities and challenges",
};

export default function CategoriesCreatePage() {
  return <CategoryFormView />;
}
