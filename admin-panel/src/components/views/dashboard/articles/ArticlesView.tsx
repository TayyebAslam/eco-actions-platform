"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { articlesApi } from "@/lib/api";
import { Article } from "@/types";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  Eye,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";

/** Thumbnail with built-in broken-image fallback managed via React state. */
function ArticleThumbnail({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-muted">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative h-12 w-16 flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full rounded-lg object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function ArticlesContent() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [deleteArticle, setDeleteArticle] = useState<Article | null>(null);
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const { data, isLoading } = useQuery({
    queryKey: ["articles", page, limit, debouncedSearch],
    queryFn: async () => {
      const response = await articlesApi.getAll({ 
        page: page + 1, 
        limit: limit,
        search: debouncedSearch || undefined,
      });
      return response.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => articlesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Article deleted successfully");
      setDeleteArticle(null);
    },
    onError: () => {
      toast.error("Failed to delete article");
    },
  });

  const columns: ColumnDef<Article>[] = [
    {
      accessorKey: "title",
      header: "Article",
      enableSorting: true,
      sortingFn: "text",
      size: 350,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.thumbnail_image ? (
            <ArticleThumbnail
              src={row.original.thumbnail_image}
              alt={row.original.title ?? ""}
            />
          ) : (
            <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-medium line-clamp-2 break-words" style={{ overflowWrap: 'anywhere' }}>{row.original.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              by {row.original.author_first_name && row.original.author_last_name ? `${row.original.author_first_name} ${row.original.author_last_name}` : row.original.author_first_name || "Unknown"}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "views_count",
      header: "Views",
      enableSorting: true,
      sortingFn: "basic",
      size: 100,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.views_count || 0}</span>
        </div>
      ),
    },
    {
      accessorKey: "points",
      header: "Points",
      enableSorting: true,
      sortingFn: "basic",
      size: 100,
      cell: ({ row }) => (
        <Badge variant="secondary">+{row.original.points} pts</Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Published",
      enableSorting: true,
      sortingFn: "datetime",
      size: 120,
      cell: ({ row }) =>
        row.original.created_at ? formatDate(row.original.created_at) : "-",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const hasEditPermission = canEdit("articles");
        const hasDeletePermission = canDelete("articles");

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  router.push(`/dashboard/articles/view/${row.original.id}`);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasEditPermission}
                onClick={() => {
                  if (hasEditPermission) {
                    router.push(`/dashboard/articles/${row.original.id}`);
                  }
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                disabled={!hasDeletePermission}
                onClick={() => hasDeletePermission && setDeleteArticle(row.original)}
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
        icon={<FileText className="mr-2 h-8 w-8" />}
        title="Articles"
        description="Manage educational content for students"
        buttonIcon={<Plus className="mr-2 h-4 w-4" />}
        buttonText="Add Article"
        onButtonClick={() => router.push('/dashboard/articles/create')}
        buttonDisabled={!canCreate("articles")}
        buttonDisabledTooltip="You don't have permission to create articles"
      />

      {/* Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
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
      <Dialog
        open={!!deleteArticle}
        onOpenChange={() => setDeleteArticle(null)}
      >
        <DialogContent className="max-[560px]:w-[calc(100%-1rem)] max-[560px]:max-h-[88dvh] max-[560px]:p-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-left">Delete Article</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground break-words max-[560px]:text-sm">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground break-all">
              {deleteArticle?.title}
            </span>
            ?
          </p>
          <DialogFooter className="flex-wrap gap-2 max-[560px]:flex-col">
            <Button className="max-[560px]:w-full" variant="outline" onClick={() => setDeleteArticle(null)}>
              Cancel
            </Button>
            <Button
              className="max-[560px]:w-full"
              variant="destructive"
              onClick={() =>
                deleteArticle && deleteMutation.mutate(deleteArticle.id)
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
    </div>
  );
}

export function ArticlesView() {
  return (
    <PermissionGuard moduleKey="articles">
      <ArticlesContent />
    </PermissionGuard>
  );
}
