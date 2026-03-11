"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./auth-provider";
import { toast } from "sonner";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const socketRef = useRef<Socket | null>(null);
  const wasDisconnectedRef = useRef<boolean>(false);

  // Handle session invalid event
  const handleSessionInvalid = useCallback(
    (data: { reason?: string }) => {
      toast.error("Session Expired", {
        description: data.reason || "Please login again.",
      });
      logout();
    },
    [logout]
  );

  // Handle logout from all devices (when user chose "logout all" on another device)
  const handleLogoutAll = useCallback(
    (data: { reason?: string }) => {
      toast.info("Logged Out", {
        description: data.reason || "You have been logged out from this device.",
      });
      logout();
    },
    [logout]
  );

  // Handle logout from single session (when user revoked this session from another device)
  const handleLogoutSingle = useCallback(
    (data: { reason?: string }) => {
      toast.info("Session Revoked", {
        description: data.reason || "This session has been revoked.",
      });
      logout();
    },
    [logout]
  );

  useEffect(() => {
    // Only connect when authenticated
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      wasDisconnectedRef.current = false;
      return;
    }

    // Don't create new connection if already connected
    if (socketRef.current?.connected) {
      return;
    }

    // Create socket connection - use backend URL directly
    // Socket.IO needs actual backend URL (rewrites don't work for WebSocket)
    const socketUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

    // Cookie-based auth: withCredentials sends cookies automatically
    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      setIsConnected(true);

      // Only check session on RECONNECT (not first connect)
      // This handles the case when internet comes back
      if (wasDisconnectedRef.current) {
        newSocket.emit("session:check");
        wasDisconnectedRef.current = false;
      }
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
      // Mark as disconnected so we can check session on reconnect
      wasDisconnectedRef.current = true;
    });

    newSocket.on("connect_error", (error) => {
      setIsConnected(false);

      // If connection error is due to auth, logout
      if (
        error.message.includes("deactivated") ||
        error.message.includes("Invalid") ||
        error.message.includes("not found")
      ) {
        toast.error("Session Expired", {
          description: error.message,
        });
        logout();
      }
    });

    // Listen for session invalid event
    newSocket.on("session:invalid", handleSessionInvalid);

    // Listen for logout all sessions event (when user chose "logout all" on another device)
    newSocket.on("session:logout_all", handleLogoutAll);

    // Listen for single session logout event (when user revoked this session from another device)
    newSocket.on("session:logout_single", handleLogoutSingle);

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.off("session:invalid", handleSessionInvalid);
      newSocket.off("session:logout_all", handleLogoutAll);
      newSocket.off("session:logout_single", handleLogoutSingle);
      newSocket.disconnect();
      socketRef.current = null;
      wasDisconnectedRef.current = false;
    };
  }, [isAuthenticated, handleSessionInvalid, handleLogoutAll, handleLogoutSingle, logout]);

  // Check session on every page navigation
  useEffect(() => {
    if (socketRef.current?.connected && isAuthenticated) {
      socketRef.current.emit("session:check");
    }
  }, [pathname, isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
