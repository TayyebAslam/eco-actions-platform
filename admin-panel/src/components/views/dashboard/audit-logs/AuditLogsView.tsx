"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditLogsApi } from "@/lib/api";
import { AuditLog } from "@/types";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  History,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Calendar,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermissions } from "@/hooks/usePermissions";

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
  { value: "APPROVE", label: "Approve" },
  { value: "REJECT", label: "Reject" },
  { value: "TOGGLE_STATUS", label: "Toggle Status" },
  { value: "PASSWORD_CHANGE", label: "Password Change" },
  { value: "PERMISSION_UPDATE", label: "Permission Update" },
];

const MODULE_OPTIONS = [
  { value: "", label: "All Modules" },
  { value: "auth", label: "Auth" },
  { value: "users", label: "Users" },
  { value: "admins", label: "Admins" },
  { value: "students", label: "Students" },
  { value: "teachers", label: "Teachers" },
  { value: "schools", label: "Schools" },
  { value: "school_requests", label: "School Requests" },
  { value: "categories", label: "Categories" },
  { value: "activities", label: "Activities" },
  { value: "challenges", label: "Challenges" },
  { value: "badges", label: "Badges" },
  { value: "levels", label: "Levels" },
  { value: "articles", label: "Articles" },
  { value: "permissions", label: "Permissions" },
];

function getActionBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  switch (action) {
    case "CREATE":
      return "success";
    case "DELETE":
    case "REJECT":
      return "destructive";
    case "UPDATE":
    case "TOGGLE_STATUS":
      return "warning";
    case "LOGIN":
    case "LOGOUT":
      return "secondary";
    case "APPROVE":
      return "success";
    default:
      return "default";
  }
}

export function AuditLogsView() {
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [actionFilter, setActionFilter] = useState("__all__");
  const [moduleFilter, setModuleFilter] = useState("__all__");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewLog, setViewLog] = useState<AuditLog | null>(null);
  const { isSuperAdmin, isAdmin } = usePermissions();

  // Only super admin and admin can access this page
  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Access denied. You do not have permission to view audit logs.</p>
      </div>
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, limit, debouncedSearch, actionFilter, moduleFilter, startDate, endDate],
    queryFn: async () => {
      const response = await auditLogsApi.getAll({
        page: page + 1,
        limit,
        search: debouncedSearch || undefined,
        action: actionFilter === "__all__" ? undefined : actionFilter,
        module: moduleFilter === "__all__" ? undefined : moduleFilter,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      return response.data.data;
    },
  });

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: "user_email",
      header: "User",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.user_email || "System"}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {row.original.user_role?.replace(/_/g, " ") || "-"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <Badge variant={getActionBadgeVariant(row.original.action)}>
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: "module",
      header: "Module",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.module.replace(/_/g, " ")}</span>
      ),
    },
    {
      accessorKey: "resource_name",
      header: "Resource",
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate">
          {row.original.resource_name || "-"}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.status === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          <span className="capitalize">{row.original.status}</span>
        </div>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Timestamp",
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewLog(row.original)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<History className="mr-2 h-8 w-8" />}
        title="Audit Logs"
        description="Track and monitor system activities and user actions"
      />

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email or resource..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>

        <Select value={actionFilter} onValueChange={(value) => { setActionFilter(value); setPage(0); }}>
          <SelectTrigger className="w-full md:w-[160px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((option) => (
              <SelectItem key={option.value || "__all__"} value={option.value || "__all__"}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={moduleFilter} onValueChange={(value) => { setModuleFilter(value); setPage(0); }}>
          <SelectTrigger className="w-full md:w-[160px]">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            {MODULE_OPTIONS.map((option) => (
              <SelectItem key={option.value || "__all__"} value={option.value || "__all__"}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
              className="w-[140px]"
              placeholder="Start date"
            />
          </div>
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
            className="w-[140px]"
            placeholder="End date"
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

      {/* View Log Detail Dialog */}
      <Dialog open={!!viewLog} onOpenChange={() => setViewLog(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto max-h-[80vh] max-[530px]:p-4">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {viewLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 max-[530px]:grid-cols-1 max-[530px]:gap-3">
                <div>
                  <Label className="text-muted-foreground">User</Label>
                  <p className="mt-1 font-medium break-words">{viewLog.user_email || "System"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  <p className="mt-1 capitalize break-words">{viewLog.user_role?.replace(/_/g, " ") || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Action</Label>
                  <p className="mt-1">
                    <Badge variant={getActionBadgeVariant(viewLog.action)}>
                      {viewLog.action}
                    </Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Module</Label>
                  <p className="mt-1 capitalize break-words">{viewLog.module.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Resource</Label>
                  <p className="mt-1 break-words">{viewLog.resource_name || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="mt-1 flex items-center gap-1">
                    {viewLog.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="capitalize">{viewLog.status}</span>
                  </p>
                </div>
                <div className="col-span-2 max-[530px]:col-span-1">
                  <Label className="text-muted-foreground">Timestamp</Label>
                  <p className="mt-1">{formatDate(viewLog.created_at)}</p>
                </div>
              </div>

              {viewLog.error_message && (
                <div>
                  <Label className="text-muted-foreground">Error Message</Label>
                  <p className="mt-1 text-destructive">{viewLog.error_message}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="max-[530px]:w-full">
            <Button variant="outline" className="max-[530px]:w-full" onClick={() => setViewLog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
