import { Metadata } from "next";
import { EditSystemUserView } from "@/components/views/dashboard/system-users/edit";

export const metadata: Metadata = {
  title: "Edit System User | Thrive Admin",
  description: "Edit platform administrator details",
};

export default function EditSystemUserPage() {
  return <EditSystemUserView />;
}
