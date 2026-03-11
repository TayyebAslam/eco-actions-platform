"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import type { Notification, NotificationType } from "@/types";

interface NotificationModalProps {
  isDark: boolean;
}

/**
 * Maps a notification to its target dashboard route.
 * Returns null if there's no meaningful page to navigate to.
 */
function getNotificationRoute(notification: Notification): string | null {
  const { type, resource_id } = notification;

  switch (type as NotificationType) {
    case "school_request":
      return "/dashboard/school-requests";

    case "pending_activities":
      return "/dashboard/activities";

    case "activity_approved":
    case "activity_rejected":
    case "comment_received":
      if (resource_id) return `/dashboard/activities`;
      return "/dashboard/activities";

    case "challenge_joined":
      return "/dashboard/challenges";

    case "new_article":
      if (resource_id) return `/dashboard/articles/view/${resource_id}`;
      return "/dashboard/articles";

    case "system_alert":
    default:
      return null;
  }
}

export function NotificationModal({ isDark }: NotificationModalProps) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    pagination,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications({ page, limit: 5 });

  const totalPages = pagination.totalPages;

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setPage(1);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    const route = getNotificationRoute(notification);
    if (route) {
      setOpen(false);
      router.push(route);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative rounded-xl transition-all duration-200",
            isDark
              ? "text-gray-400 hover:text-white hover:bg-slate-800"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
          )}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <>
              <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={2}
        className={cn(
          " w-4/5    ml-2 lg:w-[420px] lg:mx-0 lg:!relative lg:!left-auto lg:!top-auto lg:!translate-x-0 lg:!translate-y-0 p-1 rounded-2xl shadow-2xl border-2 animate-in slide-in-from-top-2 duration-200",
          isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-700">
          <div>
            <h3
              className={cn(
                "font-bold text-xl flex items-center gap-2",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              <Bell className="h-5 w-5 text-emerald-500" />
              Notifications
            </h3>
            {unreadCount > 0 && (
              <p
                className={cn(
                  "text-xs mt-1",
                  isDark ? "text-gray-400" : "text-gray-500",
                )}
              >
                {unreadCount} new notification{unreadCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className={cn(
                "text-xs font-semibold h-8 px-3 rounded-lg",
                isDark
                  ? "text-emerald-400 hover:text-emerald-300 hover:bg-slate-800"
                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50",
              )}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2
              className={cn(
                "h-8 w-8 animate-spin",
                isDark ? "text-gray-500" : "text-gray-400",
              )}
            />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                isDark ? "bg-slate-800" : "bg-gray-100",
              )}
            >
              <Bell
                className={cn(
                  "h-8 w-8",
                  isDark ? "text-gray-600" : "text-gray-400",
                )}
              />
            </div>
            <p
              className={cn(
                "text-base font-semibold mb-1",
                isDark ? "text-gray-300" : "text-gray-700",
              )}
            >
              No notifications yet
            </p>
            <p
              className={cn(
                "text-sm text-center",
                isDark ? "text-gray-500" : "text-gray-500",
              )}
            >
              We'll notify you when something new arrives
            </p>
          </div>
        ) : (
          <>
            <div className="h-[450px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="p-3 space-y-1">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "w-full flex items-start gap-3 p-4 rounded-xl transition-all duration-200 text-left group",
                      !notification.is_read &&
                        (isDark
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-emerald-50 border border-emerald-100"),
                      notification.is_read &&
                        (isDark
                          ? "border border-transparent"
                          : "border border-transparent"),
                      isDark
                        ? "hover:bg-slate-800 hover:border-slate-700"
                        : "hover:bg-gray-50 hover:border-gray-200",
                    )}
                  >
                    {/* Indicator dot */}
                    <div className="flex-shrink-0 mt-1.5">
                      {!notification.is_read ? (
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full block animate-pulse" />
                      ) : (
                        <span
                          className={cn(
                            "w-2.5 h-2.5 rounded-full block",
                            isDark ? "bg-slate-700" : "bg-gray-300",
                          )}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "font-semibold text-sm mb-1 line-clamp-1",
                          !notification.is_read
                            ? isDark
                              ? "text-white"
                              : "text-gray-900"
                            : isDark
                              ? "text-gray-300"
                              : "text-gray-700",
                        )}
                      >
                        {notification.title}
                      </p>
                      <p
                        className={cn(
                          "text-xs line-clamp-2 mb-2 leading-relaxed",
                          isDark ? "text-gray-400" : "text-gray-600",
                        )}
                      >
                        {notification.message}
                      </p>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-xs",
                          isDark ? "text-gray-500" : "text-gray-500",
                        )}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatDate(notification.created_at)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div
                className={cn(
                  "flex items-center justify-between px-5 py-3 rounded-xl bg-opacity-50 backdrop-blur-sm",
                  isDark
                    ? "border-slate-700 bg-slate-800/50"
                    : "border-gray-200 bg-gray-50/50",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-medium",
                    isDark ? "text-gray-400" : "text-gray-600",
                  )}
                >
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9 rounded-lg transition-all",
                      isDark ? "hover:bg-slate-700" : "hover:bg-gray-200",
                    )}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9 rounded-lg transition-all",
                      isDark ? "hover:bg-slate-700" : "hover:bg-gray-200",
                    )}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
