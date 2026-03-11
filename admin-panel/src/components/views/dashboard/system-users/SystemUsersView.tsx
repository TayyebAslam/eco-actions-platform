"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { systemUsersApi } from "@/lib/api";
import { SystemUser } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, Search, UserCog, Lock} from "lucide-react";
import { toast } from "sonner";
import { formatDate, getInitials } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";

export function SystemUsersView() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [deleteUser, setDeleteUser] = useState<SystemUser | null>(null);
  const queryClient = useQueryClient();
  const { isSuperAdmin } = usePermissions();

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ["system-users", page, limit, debouncedSearch],
    queryFn: async () => {
      const response = await systemUsersApi.getAll({ page: page + 1, limit: limit, search: debouncedSearch });
      return response.data.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => systemUsersApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
      toast.success("User status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => systemUsersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
      toast.success("User deleted successfully");
      setDeleteUser(null);
    },
    onError: () => {
      toast.error("Failed to delete user");
    },
  });

  const columns: ColumnDef<SystemUser>[] = [
    {
      accessorKey: "first_name",
      header: "User",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => {
        const user = row.original;
        const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="text-xs">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize text-nowrap">
          {row.original.role?.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      size: 140,
      enableSorting: true,
      sortingFn: "basic",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.is_active}
            onCheckedChange={() => toggleMutation.mutate(row.original.id)}
          />
          <span className="text-sm text-muted-foreground w-16">
            {row.original.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      enableSorting: true,
      sortingFn: "datetime",
      cell: ({ row }) => {
        return <span className="text-nowrap">{formatDate(row.original.created_at)}</span>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push(`/dashboard/system-users/${row.original.id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push(`/dashboard/system-users/${row.original.id}/edit?tab=permissions`)}
            >
              <Lock className="mr-2 h-4 w-4 " />
              Permissions
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10"
              onClick={() => setDeleteUser(row.original)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Only Super Admin can access this page
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only Super Admins can manage system users</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<UserCog className="mr-2 h-8 w-8" />}
        title="System Users"
        description="Manage platform-level administrators"
        buttonIcon={<Plus className="mr-2 h-4 w-4" />}
        buttonText="Add User"
        onButtonClick={() => router.push("/dashboard/system-users/create")}
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground break-words">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground break-all">
              {deleteUser?.email}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
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
