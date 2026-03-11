"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  pageCount?: number;
  pageIndex?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  totalCount?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  pageCount = 1,
  pageIndex = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  totalCount,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    manualPagination: true,
    pageCount,
  });

  if (isLoading) {
    return (
      <div className="rounded-md border px-2 overflow-x-auto">
        <Table className="min-w-[860px] lg:min-w-full">
          <TableHeader>
            <TableRow>
              {columns.map((column, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-md border px-3 overflow-x-auto">
        <Table className="min-w-[860px] lg:min-w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? "flex items-center gap-2 cursor-pointer select-none hover:text-foreground transition-colors"
                            : ""
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <span className="ml-auto">
                            {header.column.getIsSorted() === "asc" ? (
                              <ArrowUp className="h-4 w-4" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {onPageChange && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3 py-3 border-t">
            <div className="flex items-center gap-3 w-full justify-between flex-wrap">
              {onPageSizeChange && (
                <div className="flex items-center gap-2  w-full sm:w-auto justify-between">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    Rows per page:
                  </span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => onPageSizeChange(Number(value))}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="40">40</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="text-xs sm:text-sm text-muted-foreground w-full sm:w-auto text-center sm:text-left">
                {totalCount ? (
                  <>
                    <span className="sm:hidden">
                      {pageIndex * pageSize + 1}-{Math.min((pageIndex + 1) * pageSize, totalCount)} of {totalCount}
                    </span>
                    <span className="hidden sm:inline">
                      Showing {pageIndex * pageSize + 1} to{" "}
                      {Math.min((pageIndex + 1) * pageSize, totalCount)} of {totalCount}
                    </span>
                  </>
                ) : (
                  <span>Page {pageIndex + 1} of {pageCount}</span>
                )}
              </div>
            </div>
          
          {pageCount > 1 && (
          <div className="w-full sm:w-auto overflow-x-auto">
            {/* Page Navigation */}
            <div className="flex min-w-max items-center gap-1 sm:gap-1.5 justify-center sm:justify-start">
              {/* First Page */}
              <Button
                variant="outline"
                size="icon"
                className="hidden sm:inline-flex h-8 w-8"
                onClick={() => onPageChange(0)}
                disabled={pageIndex === 0}
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              
              {/* Previous Page */}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(pageIndex - 1)}
                disabled={pageIndex === 0}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1 mx-0.5 sm:mx-1">
                {(() => {
                  const pages: (number | string)[] = [];
                  
                  if (pageCount <= 4) {
                    // Show all pages if 4 or fewer
                    for (let i = 0; i < pageCount; i++) {
                      pages.push(i);
                    }
                  } else {
                    // Always show first page
                    pages.push(0);
                    
                    if (pageIndex > 2) {
                      pages.push('ellipsis-start');
                    }
                    
                    // Show pages around current page
                    const start = Math.max(1, pageIndex - 1);
                    const end = Math.min(pageCount - 2, pageIndex + 1);
                    
                    for (let i = start; i <= end; i++) {
                      pages.push(i);
                    }
                    
                    if (pageIndex < pageCount - 3) {
                      pages.push('ellipsis-end');
                    }
                    
                    // Always show last page
                    pages.push(pageCount - 1);
                  }
                  
                  return pages.map((page, idx) => {
                    if (typeof page === 'string') {
                      return (
                        <span key={page} className="hidden sm:inline px-2 text-muted-foreground">
                          ...
                        </span>
                      );
                    }
                    if (pageCount > 4 && page !== pageIndex && page !== 0 && page !== pageCount - 1) {
                      return (
                        <span key={page} className="hidden sm:inline-flex">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onPageChange(page)}
                          >
                            {page + 1}
                          </Button>
                        </span>
                      );
                    }
                    
                    return (
                      <Button
                        key={page}
                        variant="outline"
                        size="icon"
                        className={`h-8 w-8 ${
                          pageIndex === page
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
                            : ""
                        }`}
                        onClick={() => onPageChange(page)}
                      >
                        {page + 1}
                      </Button>
                    );
                  });
                })()}
              </div>

              {/* Next Page */}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(pageIndex + 1)}
                disabled={pageIndex >= pageCount - 1}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Last Page */}
              <Button
                variant="outline"
                size="icon"
                className="hidden sm:inline-flex h-8 w-8"
                onClick={() => onPageChange(pageCount - 1)}
                disabled={pageIndex >= pageCount - 1}
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
