"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { schoolsApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, Info, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface School {
  id: number;
  name: string;
}

interface HeaderFieldConfig {
  key: string;
  displayName: string;
  description: string;
  required: boolean;
  variations: string[]; // Different possible header names in the file
}

export interface BulkUploadConfig {
  entityName: string; // "Students", "Teachers", etc.
  entityNameSingular: string; // "Student", "Teacher", etc.
  headers: HeaderFieldConfig[];
  parseRow: (row: Record<string, unknown>, headerMap: Record<string, string>) => any;
  validateRow: (parsed: any, index: number) => string | null; // Returns error message or null
  uploadFn: (file: File, schoolId?: number) => Promise<any>;
  queryKey?: string; // Optional query key to invalidate after successful upload
}

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiresSchoolSelection: boolean;
  config: BulkUploadConfig;
}

function normalizeHeader(h: string) {
  return h
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const BulkUploadModal = React.memo(function BulkUploadModal({ open, onOpenChange, requiresSchoolSelection, config }: BulkUploadModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [totalErrors, setTotalErrors] = useState<number | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<string | undefined>(undefined);
  const [showHeadersHint, setShowHeadersHint] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: schoolsData } = useQuery({
    queryKey: ["schools-names"],
    queryFn: async () => {
      const response = await schoolsApi.getAllSchoolsWithName();
      return response.data.data;
    },
    enabled: requiresSchoolSelection,
  });

  const schools = schoolsData || [];

  useEffect(() => {
    if (!open) {
      setFile(null);
      setParsedRows([]);
      setErrors([]);
      setTotalErrors(null);
      setSelectedSchool(undefined);
      setShowHeadersHint(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [open]);

  const handleFileChange = async (f: File | null) => {
    setFile(f);
    setParsedRows([]);
    setErrors([]);

    if (!f) return;

    // Check file size
    if (f.size > MAX_FILE_SIZE) {
      setErrors(["File too large. Maximum 5MB allowed."]);
      setFile(null);
      return;
    }

    try {
      // Dynamic import with proper typing
      const XLSX = await import('xlsx');
      const ab = await f.arrayBuffer();
      const workbook = XLSX.read(ab, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setErrors(["Uploaded file has no sheets"]);
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        setErrors(["Could not read sheet from file"]);
        return;
      }
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 0, defval: "" }) as Record<string, unknown>[];

      if (raw.length === 0) {
        setErrors(["Uploaded file is empty"]);
        return;
      }

      // Normalize headers
      const firstRow = raw[0]!;
      const headers = Object.keys(firstRow).map((h) => normalizeHeader(String(h)));

      // Mapping: find which header corresponds to which required header
      const headerMap: Record<string, string> = {};

      headers.forEach((normalizedHeader, idx) => {
        const originalKey = Object.keys(firstRow)[idx];
        if (!originalKey) return;

        // Check each field config to see if this header matches any variations
        config.headers.forEach((fieldConfig) => {
          const matches = fieldConfig.variations.some((variation) => {
            const normalizedVariation = normalizeHeader(variation);
            return normalizedHeader.includes(normalizedVariation) || normalizedVariation.includes(normalizedHeader);
          });

          if (matches && !headerMap[fieldConfig.key]) {
            headerMap[fieldConfig.key] = originalKey;
          }
        });
      });

      // Check required headers exist
      const requiredFields = config.headers.filter(h => h.required);
      const missingHeaders = requiredFields.filter((field) => !headerMap[field.key]);

      if (missingHeaders.length > 0) {
        setErrors([`Missing required headers: ${missingHeaders.map(h => h.displayName).join(", ")}`]);
        return;
      }

      // parse rows: skip fully empty rows
      const parsed: any[] = [];
      const rowErrors: string[] = [];

      raw.forEach((row, index) => {
        const vals = Object.values(row).map((v) => String(v || "").trim());
        const allEmpty = vals.every((v) => v === "");
        if (allEmpty) return; // skip fully empty

        const parsedRow = config.parseRow(row, headerMap);
        const error = config.validateRow(parsedRow, index);

        if (error) {
          rowErrors.push(`Row ${index + 2}: ${error}`);
        } else {
          parsed.push(parsedRow);
        }
      });

      if (rowErrors.length > 0) {
        setErrors(rowErrors);
        setParsedRows([]);
        return;
      }

      setParsedRows(parsed);
    } catch (err: any) {
      setErrors([err.message || "Failed to parse file"]);
      setParsedRows([]);
    }
  };

  const handleSubmit = async () => {
    setErrors([]);
    setTotalErrors(null);
    if (!file) return setErrors(["Please select a file to upload"]);
    if (requiresSchoolSelection && !selectedSchool) return setErrors(["Please select a school"]);
    
    setIsSubmitting(true);
    try {
      await config.uploadFn(file, requiresSchoolSelection ? Number(selectedSchool) : undefined);
      toast.success(`${config.entityName} uploaded successfully`);
      
      // Invalidate query cache to refresh data table
      if (config.queryKey) {
        queryClient.invalidateQueries({ queryKey: [config.queryKey] });
      }
      
      onOpenChange(false);
    } catch (error: any) {
      const errorData = error.response?.data?.data;
      
      // Handle backend validation errors
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        const formattedErrors = errorData.errors.map((err: any) => 
          `Row ${err.row}: ${err.errors.join(", ")}`
        );
        setErrors(formattedErrors);
        setTotalErrors(errorData.totalErrors || formattedErrors.length);
      } else {
        setErrors([error.response?.data?.message || "Bulk upload failed"]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] md:w-full max-w-2xl max-h-[90vh] overflow-y-scroll scrollbar-thin transition-all duration-1000">
        <DialogHeader>
          <DialogTitle>Upload {config.entityName} in Bulk</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Upload a CSV or Excel file to add multiple {config.entityName.toLowerCase()} at once
          </p>
        </DialogHeader>

        <div className="space-y-6 ">
          {/* School Selection (Users without school_id) */}
          {requiresSchoolSelection && (
            <div className="space-y-2">
              <Label htmlFor="school-select" className="text-sm font-medium">
                School <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedSchool} onValueChange={(v) => setSelectedSchool(v)}>
                <SelectTrigger id="school-select">
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s: School) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* File Upload Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Upload File</Label>
              <button
                type="button"
                onClick={() => setShowHeadersHint(!showHeadersHint)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="h-4 w-4" />
                Required Headers
                {showHeadersHint ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            </div>

            {/* Collapsible Headers Info */}
            <div
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                showHeadersHint
                  ? 'max-h-96 opacity-100'
                  : 'max-h-0 opacity-0'
              }`}
            >
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Required Headers
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Your file must include the following headers:
                    </p>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 list-disc list-inside space-y-1 ml-1">
                      {config.headers.map((header) => (
                        <li key={header.key}>
                          <span className="font-medium">{header.displayName}</span>
                          {!header.required && <span className="text-xs"> (optional)</span>}
                          {" - " + header.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (requiresSchoolSelection && !selectedSchool) return;
                  inputRef.current?.click();
                }
              }}
              onClick={() => {
                if (requiresSchoolSelection && !selectedSchool) return;
                inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-primary', 'bg-primary/5');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                const f = e.dataTransfer?.files?.[0] ?? null;
                handleFileChange(f);
              }}
              className={`relative flex flex-col items-center justify-center gap-3 p-6 sm:p-8 rounded-lg border-2 border-dashed transition-colors ${
                requiresSchoolSelection && !selectedSchool
                  ? 'border-muted-foreground/10 bg-muted/5 cursor-not-allowed opacity-50'
                  : 'border-muted-foreground/25 bg-muted/5 hover:bg-muted/10 hover:border-muted-foreground/40 cursor-pointer'
              } group`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  {file ? (
                    <FileSpreadsheet className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  ) : (
                    <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  )}
                </div>
                
                {file ? (
                  <div className="text-center">
                    <p className="font-medium text-sm break-all px-2">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} rows parsed
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-medium text-sm">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      CSV, XLSX, or XLS files only
                    </p>
                  </div>
                )}
              </div>

              <input
                ref={inputRef}
                onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] ?? null : null)}
                accept=".csv, .xlsx, .xls"
                type="file"
                className="hidden"
                id="bulk-upload-file"
              />
            </div>
          </div>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Validation Errors {totalErrors !== null ? `(${totalErrors} total ${totalErrors === 1 ? 'error' : 'errors'})` : `(${errors.length} ${errors.length === 1 ? 'issue' : 'issues'} found)`}
                  </p>
                  <div className="max-h-40 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-destructive/30 scrollbar-track-transparent hover:scrollbar-thumb-destructive/50">
                    <ul className="text-sm text-destructive space-y-1.5">
                      {errors.slice(0, 5).map((e, idx) => (
                        <li key={idx} className="leading-relaxed break-words">• {e}</li>
                      ))}
                    </ul>
                  </div>
                  {errors.length > 5 && (
                    <p className="text-sm text-destructive/90 mt-3 pt-3 border-t border-destructive/20">
                      + {errors.length - 5} more {errors.length - 5 === 1 ? 'error' : 'errors'}. Please review and fix all invalid data before uploading.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSubmit}
            disabled={isSubmitting || parsedRows.length === 0 || (requiresSchoolSelection && !selectedSchool)}
            className="w-full sm:w-auto"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload {parsedRows.length > 0 && `(${parsedRows.length} ${config.entityName.toLowerCase()})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
