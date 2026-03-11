"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentsApi, schoolsApi } from "@/lib/api";
import { Student } from "@/types";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Trophy,
  Flame,
  GraduationCap,
  Sparkles,
  Eye,
  Plus,
  Search,
  FileUp,
} from "lucide-react";
import { BulkUploadModal } from './BulkUploadModal';
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/providers/auth-provider";
import { Input } from "@/components/ui/input";
import { StudentViewModal } from "./view/StudentViewModal";

function StudentsContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const debouncedSearch = useDebounce(search, 500);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [viewStudentId, setViewStudentId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const requiresSchoolSelection = !user?.school_id;

  // Fetch schools for filter dropdown (users without school_id only)
  const { data: schoolsData } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const response = await schoolsApi.getAllSchoolsWithName();
      return response.data.data;
    },
    enabled: requiresSchoolSelection,
  });

  const schools = schoolsData || [];

  const { data, isLoading } = useQuery({
    queryKey: ["students", page, limit, debouncedSearch, schoolFilter],
    queryFn: async () => {
      const params: any = { 
        page: page + 1, 
        limit: limit,
        search: debouncedSearch || undefined,
      };
      if (requiresSchoolSelection && schoolFilter !== "all") {
        // Ensure we send a numeric school_id to the backend
        params.school_id = Number(schoolFilter);
      }
      const response = await studentsApi.getAll(params);
      return response.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => studentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student deleted successfully");
      setDeleteStudent(null);
    },
    onError: () => {
      toast.error("Failed to delete student");
    },
  });

  const columns: ColumnDef<Student>[] = [
    {
      accessorKey: "name",
      header: "Student",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => {
        const student = row.original;
        const displayName = student.name || student.email;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={student.avatar_url} className="object-cover" />
              <AvatarFallback className="text-xs">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{student.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "school_name",
      header: "School",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.school_name || "-"}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.class_name}
            {row.original.section_name && ` - ${row.original.section_name}`}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "stats",
      header: "Progress",
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        // Sort by level first, then by streak days
        const levelA = rowA.original.level || 0;
        const levelB = rowB.original.level || 0;
        
        if (levelA !== levelB) {
          return levelA - levelB;
        }
        
        // If levels are equal, sort by streak days
        const streakA = rowA.original.streak_days || 0;
        const streakB = rowB.original.streak_days || 0;
        
        return streakA - streakB;
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-nowrap">
            <Trophy className="h-3 w-3" />
            Lvl {row.original.level}
          </Badge>
          <Badge variant="secondary" className="gap-1 text-nowrap">
            <Flame className="h-3 w-3" />
            {row.original.streak_days} days
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "total_points",
      header: "Points",
      enableSorting: true,
      sortingFn: "basic",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          <span className="font-semibold">
            {row.original.total_points?.toLocaleString()}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "is_active",
      enableSorting: true,
      sortingFn: "basic",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "success" : "destructive"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const hasEditPermission = canEdit("students");
        const hasDeletePermission = canDelete("students");

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setViewStudentId(row.original.user_id)}>
                <Eye className="mr-2 h-4 w-4" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasEditPermission } onClick={() => {router.push(`/dashboard/students/${row.original.user_id}/edit`)}}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive font-semibold focus:text-destructive focus:bg-destructive/10"
                disabled={!hasDeletePermission}
                onClick={() => hasDeletePermission && setDeleteStudent(row.original)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<GraduationCap className="mr-2 h-8 w-8" />}
        title="Students"
        description="Manage student accounts and assignments"
        buttonIcon={<Plus className="mr-2 h-4 w-4" />}
        buttonText="Add Student"
        onButtonClick={() => router.push('/dashboard/students/create')}
        buttonDisabled={!canCreate("students")}
        buttonDisabledTooltip="You don't have permission to add students"
        secondaryButtonText="Upload in Bulk"
        secondaryButtonIcon={<FileUp className="mr-2 h-4 w-4" />}
        onSecondaryClick={() => setBulkOpen(true)}
        secondaryDisabled={!canCreate("students")}
        secondaryDisabledTooltip="You don't have permission to upload students"
      />

      <BulkUploadModal open={bulkOpen} onOpenChange={(v) => setBulkOpen(v)} requiresSchoolSelection={requiresSchoolSelection} />

      {/* Search and Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        {requiresSchoolSelection && (
          <Select
            value={schoolFilter}
            onValueChange={(value) => {
              setSchoolFilter(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by school" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schools</SelectItem>
              {schools.map((school: any) => (
                <SelectItem key={school.id} value={String(school.id)}>
                  {school.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        pageCount={data?.totalPages || 1}
        pageIndex={page}
        pageSize={limit}
        totalCount={data?.totalCount}
        onPageChange={setPage}
        onPageSizeChange={setLimit}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteStudent} onOpenChange={() => setDeleteStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground break-words">
            Are you sure you want to delete this student? All their activities,
            badges, and progress will be permanently lost.
          </p>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDeleteStudent(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteStudent && deleteMutation.mutate(deleteStudent.user_id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student View Modal */}
      <StudentViewModal
        studentId={viewStudentId}
        open={!!viewStudentId}
        onOpenChange={(open) => !open && setViewStudentId(null)}
      />
    </div>
  );
}

export function StudentsView() {
  return (
    <PermissionGuard moduleKey="students">
      <StudentsContent />
    </PermissionGuard>
  );
}
