import { Metadata } from "next";
import { RoleFormView } from "@/components/views/dashboard/roles/form/RoleFormView";

export const metadata: Metadata = {
  title: "Edit Role - Eco Actions",
  description: "Edit role information",
};

export default function RolesEditPage() {
  return <RoleFormView />;
}
