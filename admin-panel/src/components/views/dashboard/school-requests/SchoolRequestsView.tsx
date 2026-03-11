"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  School as SchoolIcon,
  Clock,
  Eye,
  ClipboardCheck,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDebounce } from "@/hooks/useDebounce";

type SchoolRequest = {
  id: number;
  admin_email: string;
  admin_first_name: string;
  admin_last_name: string;
  school_name: string;
  school_slug: string;
  school_address: string | null;
  school_logo_url: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export function SchoolRequestsView() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [selectedRequest, setSelectedRequest] = useState<SchoolRequest | null>(
    null
  );
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch school requests
  const { data, isLoading } = useQuery({
    queryKey: ["school-requests", page, limit, statusFilter, debouncedSearch],
    queryFn: async () => {
      const response = await api.get("/admin/school-requests", {
        params: { 
          page: page + 1,
          limit: limit,
          status: statusFilter, 
          search: debouncedSearch || undefined,
        },
      });
      return response.data.data;
    },
  });

  const requests: SchoolRequest[] = data?.data || [];

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      return api.post(`/admin/school-requests/${requestId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-requests"] });
      toast.success("School request approved successfully!");
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to approve request"
      );
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: {
      requestId: number;
      reason: string;
    }) => {
      return api.post(`/admin/school-requests/${requestId}/reject`, {
        rejection_reason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-requests"] });
      toast.success("School request rejected");
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to reject request");
    },
  });

  const handleApprove = () => {
    if (!selectedRequest) return;
    approveMutation.mutate(selectedRequest.id);
    setShowApproveDialog(false);
  };

  const openApproveDialog = (request: SchoolRequest) => {
    setSelectedRequest(request);
    setShowApproveDialog(true);
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    rejectMutation.mutate({
      requestId: selectedRequest.id,
      reason: rejectionReason,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive-strong border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  const columns: ColumnDef<SchoolRequest>[] = [
    {
      accessorKey: "school_name",
      header: "School",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => {
        const request = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 rounded-lg">
              <AvatarImage
                src={request.school_logo_url || undefined}
                className="object-cover"
              />
              <AvatarFallback className="rounded-lg bg-primary/10">
                <SchoolIcon className="h-5 w-5 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{request.school_name}</div>
              <div className="text-xs text-muted-foreground">
                {request.school_slug}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "admin_first_name",
      header: "Admin",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {row.original.admin_first_name} {row.original.admin_last_name}
        </span>
      ),
    },
    {
      accessorKey: "admin_email",
      header: "Email",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{row.original.admin_email}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Submitted",
      size: 200,
      enableSorting: true,
      sortingFn: "datetime",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.created_at), {
            addSuffix: true,
          })}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      id: "actions",
      header: () => <div className="text-center">Actions</div>,
      cell: ({ row }) => {
        const request = row.original;
        return (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedRequest(request);
                setShowViewDialog(true);
              }}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {request.status === "pending" && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openApproveDialog(request)}
                  disabled={approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white h-8"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSelectedRequest(request);
                    setShowRejectDialog(true);
                  }}
                  disabled={rejectMutation.isPending}
                  className="h-8"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ClipboardCheck className="mr-2 h-8 w-8" />}
        title="School Registration Requests"
        description="Review and approve or reject school registration requests"
      />

      {/* Search and Filters */}
      <div className="flex sm:flex-row sm:items-center gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by school name, admin name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-11 rounded-xl">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <div className="">
        <DataTable
          columns={columns}
          data={requests}
          isLoading={isLoading}
          pageCount={data?.totalPages || 1}
          pageIndex={page}
          pageSize={limit}
          totalCount={data?.totalCount}
          onPageChange={setPage}
          onPageSizeChange={setLimit}
        />
      </div>

      {/* View Details Dialog */}
      <Dialog
        open={showViewDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowViewDialog(false);
            setSelectedRequest(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>
              Review the school registration information
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 rounded-lg">
                  <AvatarImage
                    src={selectedRequest.school_logo_url || undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-lg bg-primary/10">
                    <SchoolIcon className="h-10 w-10 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedRequest.school_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.school_slug}
                  </p>
                  {getStatusBadge(selectedRequest.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Admin Name</Label>
                  <p className="font-medium">
                    {selectedRequest.admin_first_name}{" "}
                    {selectedRequest.admin_last_name}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Admin Email</Label>
                  <p className="font-medium">{selectedRequest.admin_email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p className="font-medium">
                    {formatDistanceToNow(
                      new Date(selectedRequest.created_at),
                      { addSuffix: true }
                    )}
                  </p>
                </div>
                {selectedRequest.reviewed_at && (
                  <div>
                    <Label className="text-muted-foreground">Reviewed</Label>
                    <p className="font-medium">
                      {formatDistanceToNow(
                        new Date(selectedRequest.reviewed_at),
                        { addSuffix: true }
                      )}
                    </p>
                  </div>
                )}
              </div>

              {selectedRequest.school_address && (
                <div>
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="font-medium">{selectedRequest.school_address}</p>
                </div>
              )}

              {selectedRequest.rejection_reason && (
                <div>
                  <Label className="text-muted-foreground">
                    Rejection Reason
                  </Label>
                  <p className="font-medium text-destructive">
                    {selectedRequest.rejection_reason}
                  </p>
                </div>
              )}

              {selectedRequest.status === "pending" && (
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setShowViewDialog(false);
                      setShowRejectDialog(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setShowViewDialog(false);
                      handleApprove();
                    }}
                    disabled={approveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this school registration request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection_reason">Rejection Reason *</Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject 
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve School Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this school registration request? 
              This will create the school and admin account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
