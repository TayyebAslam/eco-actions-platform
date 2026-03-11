import { Metadata } from "next";
import { SystemUsersView } from "@/components/views/dashboard/system-users";

export const metadata: Metadata = {
  title: "System Users | Eco Actions Admin",
  description: "Manage platform-level administrators",
};

export default function SystemUsersPage() {
  return <SystemUsersView />;
}
