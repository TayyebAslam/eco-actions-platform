import { Metadata } from 'next';
import { StudentFormView } from "@/components/views/dashboard/students/form/StudentForm";

export const metadata: Metadata = {
  title: 'Create Student - Thrive',
  description: 'Add a new student to the system',
};

export default function StudentsCreatePage() {
  return <StudentFormView />;
}
