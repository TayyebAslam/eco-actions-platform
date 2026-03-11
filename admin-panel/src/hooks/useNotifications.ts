"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "@/providers/socket-provider";
import { notificationsApi } from "@/lib/api";
import { toast } from "sonner";
import type { Notification, NotificationType } from "@/types";

interface UseNotificationsOptions {
  page?: number;
  limit?: number;
  is_read?: boolean;
  type?: NotificationType;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { page = 1, limit = 5, is_read, type } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 5,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { socket, isConnected } = useSocket();
  const mountedRef = useRef(true);
  const pageRef = useRef(page);
  pageRef.current = page;

  // Fetch notifications (includes unreadCount in response)
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, unknown> = { page, limit };
      if (is_read !== undefined) params.is_read = is_read;
      if (type) params.type = type;

      const response = await notificationsApi.getAll(params as any);
      if (!mountedRef.current) return;

      const data = response.data?.data;
      if (data) {
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount ?? 0);
        setPagination({
          currentPage: data.page || 1,
          totalPages: data.totalPages || 1,
          totalCount: data.totalCount || 0,
          limit: data.limit || limit,
        });
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [page, limit, is_read, type]);

  // Mark single notification as read (only decrement if it was actually unread)
  const markAsRead = useCallback(
    async (id: number) => {
      try {
        const target = notifications.find((n) => n.id === id);
        const wasUnread = target && !target.is_read;

        await notificationsApi.markAsRead(id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
          )
        );
        if (wasUnread) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    },
    [notifications]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchNotifications]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNew = (notification: Notification) => {
      // Only prepend if on page 1, otherwise just update unread count
      if (pageRef.current === 1) {
        setNotifications((prev) => [notification, ...prev].slice(0, limit));
      }
      setUnreadCount((prev) => prev + 1);
      toast.info(notification.title, {
        description: notification.message,
      });
    };

    const handleUpdated = (notification: Notification) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? notification : n
        )
      );
    };

    const handleUnreadCount = (data: { count: number }) => {
      setUnreadCount(data.count);
    };

    socket.on("notification:new", handleNew);
    socket.on("notification:updated", handleUpdated);
    socket.on("notification:unread_count", handleUnreadCount);

    return () => {
      socket.off("notification:new", handleNew);
      socket.off("notification:updated", handleUpdated);
      socket.off("notification:unread_count", handleUnreadCount);
    };
  }, [socket, isConnected]);

  return {
    notifications,
    unreadCount,
    pagination,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
