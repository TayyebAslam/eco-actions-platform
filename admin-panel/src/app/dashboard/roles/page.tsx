import { Metadata } from "next";
import { RolesView } from "@/components/views/dashboard/roles";

export const metadata: Metadata = {
  title: "Role Settings | Thrive Admin",
  description: "Manage role display names",
};

export default function RolesPage() {
  return <RolesView />;
}
