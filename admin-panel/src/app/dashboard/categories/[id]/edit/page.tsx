import { Metadata } from "next";
import { CategoryFormView } from "@/components/views/dashboard/categories/form/CategoryFormView";

export const metadata: Metadata = {
  title: "Edit Category - Thrive",
  description: "Edit category details",
};

export default function EditCategoryPage() {
  return <CategoryFormView />;
}
