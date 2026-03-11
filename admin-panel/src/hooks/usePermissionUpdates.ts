"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "@/providers/socket-provider";
import { useAuth, PermissionUpdatePayload } from "@/providers/auth-provider";

/**
 * Hook to listen for real-time permission updates via Socket.io
 * When permissions are updated by Super Admin, this hook will update the user's permissions
 */
export function usePermissionUpdates() {
  const { socket, isConnected } = useSocket();
  const { updatePermissions } = useAuth();
  const updatePermissionsRef = useRef(updatePermissions);

  // Keep ref updated
  useEffect(() => {
    updatePermissionsRef.current = updatePermissions;
  }, [updatePermissions]);

  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    const handlePermissionsUpdated = (data: { permissions: PermissionUpdatePayload[] }) => {
      updatePermissionsRef.current(data.permissions);
    };

    socket.on("permissions:updated", handlePermissionsUpdated);

    return () => {
      socket.off("permissions:updated", handlePermissionsUpdated);
    };
  }, [socket, isConnected]);
}
