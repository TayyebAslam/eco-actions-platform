import { Metadata } from "next";
import { CreateSystemUserView } from "@/components/views/dashboard/system-users/create";

export const metadata: Metadata = {
  title: "Create System User | Thrive Admin",
  description: "Create a new platform administrator",
};

export default function CreateSystemUserPage() {
  return <CreateSystemUserView />;
}
