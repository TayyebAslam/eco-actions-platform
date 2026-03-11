import { Metadata } from "next";
import { RoleFormView } from "@/components/views/dashboard/roles/form/RoleFormView";

export const metadata: Metadata = {
  title: "Create Role - Eco Actions",
  description: "Create a new role for system users",
};

export default function RolesCreatePage() {
  return <RoleFormView />;
}
