"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teachersApi, schoolsApi } from "@/lib/api";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Eye,
  Search,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/providers/auth-provider";
import { useDebounce } from "@/hooks/useDebounce";
import { TeacherBulkUploadModal } from "./BulkUploadModal";

interface Teacher {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  school_id: number;
  school_name?: string;
  is_active: boolean;
  created_at: string;
}

function TeachersContent() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [deleteTeacher, setDeleteTeacher] = useState<Teacher | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  
  const requiresSchoolSelection = !user?.school_id;
  const debouncedSearch = useDebounce(search, 500);

  // Fetch schools for filter dropdown (users without school_id only)
  const { data: schoolsData } = useQuery({
    queryKey: ["schools-names"],
    queryFn: async () => {
      const response = await schoolsApi.getAllSchoolsWithName();
      return response.data.data;
    },
    enabled: requiresSchoolSelection,
  });

  const schools = schoolsData || [];


  const { data, isLoading } = useQuery({
    queryKey: ["teachers", page, limit, debouncedSearch, schoolFilter],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        limit: limit,
        search: debouncedSearch || undefined,
      };
      if (requiresSchoolSelection && schoolFilter !== "all") {
        params.school_id = Number(schoolFilter);
      }
      const response = await teachersApi.getAll(params);
      return response.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => teachersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher deleted successfully");
      setDeleteTeacher(null);
    },
    onError: () => {
      toast.error("Failed to delete teacher");
    },
  });

  const columns: ColumnDef<Teacher>[] = [
    {
      accessorKey: "first_name",
      header: "Teacher",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium">{row.original.first_name} {row.original.last_name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => row.original.email || "N/A",
    },
    {
      accessorKey: "school_name",
      header: "School",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => row.original.school_name || "N/A",
    },
    {
      accessorKey: "is_active",
      header: "Status",
      enableSorting: true,
      sortingFn: "basic",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "success" : "secondary"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const hasEditPermission = canEdit("teachers");
        const hasDeletePermission = canDelete("teachers");

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/dashboard/teachers/${row.original.user_id}?mode=view`)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasEditPermission}
                onClick={() => hasEditPermission && router.push(`/dashboard/teachers/${row.original.user_id}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                disabled={!hasDeletePermission}
                onClick={() => hasDeletePermission && setDeleteTeacher(row.original)}
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users className="mr-2 h-8 w-8" />}
        title="Teachers"
        description="Manage teacher accounts and assignments"
        buttonIcon={<Plus className="mr-2 h-4 w-4" />}
        buttonText="Add Teacher"
        onButtonClick={() => router.push('/dashboard/teachers/create')}
        buttonDisabled={!canCreate("teachers")}
        buttonDisabledTooltip="You don't have permission to add teachers"
        secondaryButtonIcon={<FileUp className="mr-2 h-4 w-4" />}
        secondaryButtonText="Upload in Bulk"
        onSecondaryClick={() => setShowBulkUpload(true)}
        secondaryDisabled={!canCreate("teachers")}
        secondaryDisabledTooltip="You don't have permission to upload teachers"
      />

      <div className="flex items-center gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search teachers..."
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
      <Dialog open={!!deleteTeacher} onOpenChange={() => setDeleteTeacher(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Teacher</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground break-words">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground break-all">
              {deleteTeacher?.first_name} {deleteTeacher?.last_name}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDeleteTeacher(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTeacher && deleteMutation.mutate(deleteTeacher.user_id)}
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

      {/* Bulk Upload Modal */}
      <TeacherBulkUploadModal
        open={showBulkUpload}
        onOpenChange={(open) => {
          setShowBulkUpload(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ["teachers"] });
          }
        }}
        requiresSchoolSelection={requiresSchoolSelection}
      />
    </div>
  );
}

export function TeachersView() {
  return (
    <PermissionGuard moduleKey="teachers">
      <TeachersContent />
    </PermissionGuard>
  );
}
