"use client";

import { teachersApi } from "@/lib/api";
import { BulkUploadModal, BulkUploadConfig } from "@/components/modals/BulkUploadModal";

interface ParsedTeacher {
  name: string;
  email: string;
  contact_no: string;
}

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiresSchoolSelection: boolean;
}

const teacherBulkUploadConfig: BulkUploadConfig = {
  entityName: "Teachers",
  entityNameSingular: "Teacher",
  queryKey: "teachers",
  headers: [
    {
      key: "name",
      displayName: "Name",
      description: "Full name of the teacher",
      required: true,
      variations: ["name", "teacher name", "full name", "teacher"],
    },
    {
      key: "email",
      displayName: "Email",
      description: "Valid email address",
      required: true,
      variations: ["email", "email address", "mail"],
    },
    {
      key: "contact_no",
      displayName: "Contact No",
      description: "Teacher's contact or phone number (optional)",
      required: false,
      variations: ["contact no", "contact number", "phone number", "phone", "contact", "mobile"],
    },
  ],
  parseRow: (row, headerMap) => {
    const name = row[headerMap["name"]!] || "";
    const email = row[headerMap["email"]!] || "";
    const contactNo = row[headerMap["contact_no"]!] || "";

    return {
      name: String(name).trim(),
      email: String(email).trim(),
      contact_no: String(contactNo).trim(),
    };
  },
  validateRow: (parsed: ParsedTeacher, index: number) => {
    const missing: string[] = [];
    if (!parsed.name) missing.push("Name");
    if (!parsed.email) missing.push("Email");
    // contact_no is optional - no validation needed

    // basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (parsed.email && !emailRegex.test(parsed.email)) {
      missing.push("Email (invalid)");
    }

    if (missing.length > 0) {
      return `Missing/invalid fields: ${missing.join(", ")}`;
    }

    return null;
  },
  uploadFn: (file: File, schoolId?: number) => {
    return teachersApi.bulkUpload(file, schoolId);
  },
};

export function TeacherBulkUploadModal({ open, onOpenChange, requiresSchoolSelection }: BulkUploadModalProps) {
  return (
    <BulkUploadModal
      open={open}
      onOpenChange={onOpenChange}
      requiresSchoolSelection={requiresSchoolSelection}
      config={teacherBulkUploadConfig}
    />
  );
}
