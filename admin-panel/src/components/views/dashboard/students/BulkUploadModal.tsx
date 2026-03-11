"use client";

import { studentsApi } from "@/lib/api";
import { BulkUploadModal as BaseBulkUploadModal, BulkUploadConfig } from "@/components/modals/BulkUploadModal";

interface ParsedStudent {
  name: string;
  class_name: string;
  section_name: string | null;
  phone: string;
  school_email: string;
}

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiresSchoolSelection: boolean;
}

const studentBulkUploadConfig: BulkUploadConfig = {
  entityName: "Students",
  entityNameSingular: "Student",
  queryKey: "students",
  headers: [
    {
      key: "student_name",
      displayName: "Student Name",
      description: "Full name of the student",
      required: true,
      variations: ["student name", "name", "student"],
    },
    {
      key: "class",
      displayName: "Class",
      description: "Class name or grade",
      required: true,
      variations: ["class", "grade", "class name"],
    },
    {
      key: "section",
      displayName: "Section",
      description: "Section name",
      required: false,
      variations: ["section", "section name"],
    },
    {
      key: "contact",
      displayName: "Contact Number",
      description: "Student's contact or phone number",
      required: true,
      variations: ["contact number", "phone number", "phone", "contact", "mobile"],
    },
    {
      key: "school_email",
      displayName: "School Email",
      description: "Valid email address",
      required: true,
      variations: ["school email", "email", "school mail"],
    },
  ],
  parseRow: (row, headerMap) => {
    const studentName = row[headerMap["student_name"]!] || "";
    const className = row[headerMap["class"]!] || "";
    const sectionName = row[headerMap["section"]!] || "";
    const phone = row[headerMap["contact"]!] || "";
    const schoolEmail = row[headerMap["school_email"]!] || "";

    return {
      name: String(studentName).trim(),
      class_name: String(className).trim(),
      section_name: String(sectionName).trim() || null,
      phone: String(phone).trim(),
      school_email: String(schoolEmail).trim(),
    };
  },
  validateRow: (parsed: ParsedStudent, index: number) => {
    const missing: string[] = [];
    if (!parsed.name) missing.push("Student Name");
    if (!parsed.class_name) missing.push("Class");
    if (!parsed.phone) missing.push("Contact Number/Phone Number");
    if (!parsed.school_email) missing.push("School email");

    // basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (parsed.school_email && !emailRegex.test(parsed.school_email)) {
      missing.push("School email (invalid)");
    }

    if (missing.length > 0) {
      return `Missing/invalid fields: ${missing.join(", ")}`;
    }

    return null;
  },
  uploadFn: (file: File, schoolId?: number) => {
    return studentsApi.bulkUpload(file, schoolId);
  },
};

export function BulkUploadModal({ open, onOpenChange, requiresSchoolSelection }: BulkUploadModalProps) {
  return (
    <BaseBulkUploadModal
      open={open}
      onOpenChange={onOpenChange}
      requiresSchoolSelection={requiresSchoolSelection}
      config={studentBulkUploadConfig}
    />
  );
}
