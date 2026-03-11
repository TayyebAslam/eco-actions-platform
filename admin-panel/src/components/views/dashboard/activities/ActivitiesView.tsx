"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { activitiesApi } from "@/lib/api";
import { Activities } from "@/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  MoreHorizontal,
  Check,
  X,
  Eye,
  Trash2,
  Loader2,
  ImageIcon,
  Activity,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, getAssetUrl, getInitials, isValidUrl } from "@/lib/utils";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";

function ActivitiesContent() {
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [status, setStatus] = useState<string>("pending");
  const [viewActivity, setViewActivity] = useState<Activities | null>(null);
  const [approveActivity, setApproveActivity] = useState<Activities | null>(null);
  const [points, setPoints] = useState("");
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();


  const { data, isLoading } = useQuery({
    queryKey: ["activities", page, limit, debouncedSearch, status],
    queryFn: async () => {
      const response = await activitiesApi.getAll({
        page: page + 1,
        limit: limit,
        search: debouncedSearch || undefined,
        status,
      });
      return response.data.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, points }: { id: number; points: number }) =>
      activitiesApi.approve(id, points),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Activity approved!");
      setApproveActivity(null);
      setPoints("");
    },
    onError: () => {
      toast.error("Failed to approve activity");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => activitiesApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Activity rejected");
    },
    onError: () => {
      toast.error("Failed to reject activity");
    },
  });

  const columns: ColumnDef<Activities>[] = [
    {
      accessorKey: "user_name",
      header: "Student",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => {
        const activity = row.original;
        return (
          <div className="flex min-w-[160px] items-start gap-2 sm:gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs">
                {getInitials(activity.user_name || "U")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight line-clamp-2">{activity.user_name || "Unknown"}</p>
              <p className="text-xs text-muted-foreground leading-tight line-clamp-2">
                {activity.school_name}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "title",
      header: "Activity",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => (
        <div className="min-w-[180px]">
          <p className="text-sm font-medium leading-tight line-clamp-2">{row.original.title || "Untitled"}</p>
          <p className="text-xs text-muted-foreground leading-tight line-clamp-2">
            {row.original.description}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "category_name",
      header: "Category",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.category_name}</Badge>
      ),
    },
    {
      accessorKey: "photos",
      header: "Photos",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{row.original.photos?.length || 0}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant={
              status === "approved"
                ? "success"
                : status === "rejected"
                ? "destructive"
                : "warning"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "points",
      header: "Points",
      cell: ({ row }) => (
        <span className="font-semibold text-green-600">
          {row.original.points > 0 ? `+${row.original.points}` : "-"}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Submitted",
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const hasEditPermission = canEdit("activities");

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setViewActivity(row.original)}}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {row.original.status === "pending" && (
                <>
                  <DropdownMenuItem
                    onClick={() => hasEditPermission && setApproveActivity(row.original)}
                    className="text-green-600"
                    disabled={!hasEditPermission}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => hasEditPermission && rejectMutation.mutate(row.original.id)}
                    className="text-destructive font-semibold focus:text-destructive focus:bg-destructive/10"
                    disabled={!hasEditPermission}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Activity className="mr-2 h-8 w-8" />}
        title="Activities"
        description="Review and approve student eco-actions"
      />

      {/* Search and Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
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

      {/* View Activity Dialog */}
      <Dialog open={!!viewActivity} onOpenChange={() => setViewActivity(null)}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[80vh] max-[680px]:w-[calc(100%-1rem)] max-[680px]:max-w-none max-[680px]:max-h-[88dvh] max-[680px]:p-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-left leading-tight break-words">
              {viewActivity?.title || "Activity Details"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Description</Label>
              <p className="mt-1">{viewActivity?.description || "No description"}</p>
            </div>
            {viewActivity?.photos && viewActivity.photos.length > 0 && (
              <div>
                <Label className="text-muted-foreground">Photos</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {viewActivity?.photos.map((photo, i) => 
                  {
                    const url = isValidUrl(getAssetUrl(photo)) ? getAssetUrl(photo) : '/icons/leaf.svg';
                    return(  <div key={i} className="relative w-full h-40">
                      <Image
                        src={url}
                        alt={`Photo ${i + 1}`}
                        fill
                        className="object-cover rounded-lg"
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    </div>)}
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewActivity(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog
        open={!!approveActivity}
        onOpenChange={() => setApproveActivity(null)}
      >
        <DialogContent className="max-[540px]:w-[calc(100%-1rem)] max-[540px]:max-h-[88dvh] max-[540px]:p-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-left">Approve Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground max-[540px]:text-sm">
              Assign points for this eco-action.
            </p>
            <div className="space-y-2">
              <Label>Points to Award</Label>
              <Input
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="e.g., 10"
                min="1"
              />
            </div>
          </div>
          <DialogFooter className="max-[540px]:flex-col max-[540px]:gap-2">
            <Button className="max-[540px]:w-full" variant="outline" onClick={() => setApproveActivity(null)}>
              Cancel
            </Button>
            <Button
              className="max-[540px]:w-full"
              onClick={() =>
                approveActivity &&
                approveMutation.mutate({
                  id: approveActivity.id,
                  points: parseInt(points) || 10,
                })
              }
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ActivitiesView() {
  return (
    <PermissionGuard moduleKey="activities">
      <ActivitiesContent />
    </PermissionGuard>
  );
}
