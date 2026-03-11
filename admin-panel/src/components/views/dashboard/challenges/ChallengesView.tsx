"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { challengesApi, schoolsApi } from "@/lib/api";
import { Challenge } from "@/types";
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
  Trophy,
  Calendar,
  Eye,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/providers/auth-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/useDebounce";

function ChallengesContent() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canEdit, canDelete } = usePermissions();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [scope, setScope] = useState<"all" | "school">("all");
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [deleteChallenge, setDeleteChallenge] = useState<Challenge | null>(null);
  
  const requiresSchoolSelection = !user?.school_id;
  const debouncedSearch = useDebounce(search, 500);

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
    queryKey: ["challenges", page, limit, scope, debouncedSearch, schoolFilter],
    queryFn: async () => {
      const params: any = { page: page + 1, limit: limit };
      if (!requiresSchoolSelection) {
        params.scope = scope;
      }
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (requiresSchoolSelection && schoolFilter !== "all") {
        params.school_id = schoolFilter;
      }
      const response = await challengesApi.getAll(params);
      return response.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => challengesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      toast.success("Challenge deleted successfully");
      setDeleteChallenge(null);
    },
    onError: () => {
      toast.error("Failed to delete challenge");
    },
  });

  const columns: ColumnDef<Challenge>[] = [
    {
      accessorKey: "title",
      header: "Challenge",
      enableSorting: true,
      sortingFn: "text",
      size: 280,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-100">
            <Trophy className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="font-medium line-clamp-2 break-words" style={{ overflowWrap: 'anywhere' }}>{row.original.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1 break-words">
              {row.original.description}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "school_name",
      header: "School",
      enableSorting: true,
      sortingFn: "text",
      size: 180,
      cell: ({ row }) => (
        <span className="break-words">{row.original.school_name || "All Schools"}</span>
      ),
    },
    {
      accessorKey: "start_date",
      header: "Duration",
      enableSorting: true,
      sortingFn: "datetime",
      size: 160,
      cell: ({ row }) => (
        <div className="text-sm whitespace-nowrap">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {row.original.start_date
                ? formatDate(row.original.start_date)
                : "Not set"}
            </span>
          </div>
          <div className="text-muted-foreground text-xs">
            to{" "}
            {row.original.end_date
              ? formatDate(row.original.end_date)
              : "Not set"}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "variants",
      header: "Variants",
      enableSorting: true,
      size: 100,
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.variants?.length || 0;
        const b = rowB.original.variants?.length || 0;
        return a - b;
      },
      cell: ({ row }) => (
        <Badge variant="secondary">
          {row.original.variants?.length || 0} levels
        </Badge>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      enableSorting: true,
      sortingFn: "basic",
      size: 100,
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
        const hasEditPermission = canEdit("challenges");
        const hasDeletePermission = canDelete("challenges");

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/dashboard/challenges/${row.original.id}?mode=view`)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasEditPermission}
                onClick={() => hasEditPermission && router.push(`/dashboard/challenges/${row.original.id}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                disabled={!hasDeletePermission}
                onClick={() => hasDeletePermission && setDeleteChallenge(row.original)}
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
        icon={<Trophy className="mr-2 h-8 w-8" />}
        title="Challenges"
        description="Create and manage sustainability challenges"
        buttonIcon={<Plus className="mr-2 h-4 w-4" />}
        buttonText="Add Challenge"
        onButtonClick={() => router.push('/dashboard/challenges/create')}
      />

     <div className="flex items-center gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search challenges..."
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

      {!requiresSchoolSelection && (
        <Tabs 
          value={scope} 
          onValueChange={(value) => {
            setScope(value as "all" | "school");
            setPage(0);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All Challenges</TabsTrigger>
            <TabsTrigger value="school">My School Only</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

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

      <Dialog open={!!deleteChallenge} onOpenChange={() => setDeleteChallenge(null)}>
        <DialogContent className="max-[560px]:w-[calc(100%-1rem)] max-[560px]:max-h-[88dvh] max-[560px]:p-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-left">Delete Challenge</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground break-words max-[560px]:text-sm">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground break-all">
              {deleteChallenge?.title}
            </span>
            ? All progress data will be lost.
          </p>
          <DialogFooter className="flex-wrap gap-2 max-[560px]:flex-col">
            <Button className="max-[560px]:w-full" variant="outline" onClick={() => setDeleteChallenge(null)}>
              Cancel
            </Button>
            <Button
              className="max-[560px]:w-full"
              variant="destructive"
              onClick={() => deleteChallenge && deleteMutation.mutate(deleteChallenge.id)}
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
    </div>
  );
}

export function ChallengesView() {
  return (
    <PermissionGuard moduleKey="challenges">
      <ChallengesContent />
    </PermissionGuard>
  );
}
