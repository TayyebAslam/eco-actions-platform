import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import { config } from "dotenv";
import db from "../../../config/db";
import { TABLE } from "../../Database/table";

config();

// Get allowed origins for Socket.io (needs explicit array, not function)
const getSocketAllowedOrigins = (): string[] => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin !== "");
  }

  // Development fallback
  if (process.env.NODE_ENV === "development") {
    return [
      "http://localhost:3000",
      "http://localhost:5000",
    ];
  }

  // Production: require explicit ALLOWED_ORIGINS
  console.warn("⚠️  WARNING: ALLOWED_ORIGINS not set for Socket.io");
  return [];
};

const socketAllowedOrigins = getSocketAllowedOrigins();

let io: Server | null = null;

// Map to track session tokens to socket IDs
const sessionSocketMap = new Map<string, string>();

interface AuthenticatedSocket extends Socket {
  userId?: number;
  sessionToken?: string;
}

/**
 * Validate user session - check if user exists and is active
 */
const validateUserSession = async (userId: number): Promise<{ valid: boolean; reason?: string }> => {
  try {
    console.log(`Validating session for user ID: ${userId} (type: ${typeof userId})`);
    const user = await db(TABLE.USERS).where({ id: userId }).first();

    if (!user) {
      console.error(`User not found in database with ID: ${userId}`);
      return { valid: false, reason: "User not found" };
    }

    if (!user.is_active) {
      console.error(`User ${userId} is inactive`);
      return { valid: false, reason: "Your account has been deactivated" };
    }

    console.log(`User ${userId} session validated successfully`);
    return { valid: true };
  } catch (error) {
    console.error("Error validating user session:", error);
    return { valid: false, reason: "Session validation failed" };
  }
};

/**
 * Initialize Socket.io server
 */
export const initializeSocket = (httpServer: HttpServer): Server => {
  console.log("Socket.io allowed origins:", socketAllowedOrigins);

  io = new Server(httpServer, {
    cors: {
      origin: socketAllowedOrigins, // Explicit array of origins
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Session-Token"],
    },
    // Production settings
    transports: ["websocket", "polling"], // WebSocket first, polling fallback
    allowEIO3: true, // Allow Engine.IO v3 clients
  });

  // Authentication middleware - accept token from cookies OR auth options
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      let accessToken: string | undefined;
      let sessionToken: string | undefined;

      // Try to get token from auth options first (for cross-origin scenarios)
      const authToken = socket.handshake.auth?.token;
      if (authToken) {
        accessToken = authToken;
        sessionToken = socket.handshake.auth?.sessionToken;
      } else {
        // Fallback to cookies (for same-origin scenarios)
        const cookieHeader = socket.handshake.headers.cookie;
        if (!cookieHeader) {
          return next(new Error("Authentication required"));
        }

        const cookies = cookie.parse(cookieHeader);
        accessToken = cookies.accessToken;
        sessionToken = cookies.sessionToken;
      }

      if (!accessToken) {
        return next(new Error("Authentication token required"));
      }

      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET as string) as { id: string };
      const userId = parseInt(decoded.id, 10);

      console.log(`Socket auth: Decoded user ID: ${userId} (type: ${typeof decoded.id})`);

      // Validate user session
      const sessionResult = await validateUserSession(userId);
      if (!sessionResult.valid) {
        console.error(`Socket auth failed for user ${userId}: ${sessionResult.reason}`);
        return next(new Error(sessionResult.reason || "Invalid session"));
      }

      // Validate session token if provided
      if (sessionToken) {
        const session = await db(TABLE.USER_SESSIONS)
          .where({
            session_token: sessionToken,
            user_id: userId,
            is_active: true,
          })
          .where("expires_at", ">", new Date())
          .first();

        if (!session) {
          return next(new Error("Invalid or expired session"));
        }

        socket.sessionToken = sessionToken;
      }

      socket.userId = userId;
      next();
    } catch (error) {
      return next(new Error("Invalid authentication token"));
    }
  });

  // Connection handler
  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.userId;
    const sessionToken = socket.sessionToken;

    if (userId) {
      // Join user-specific room
      const userRoom = `user:${userId}`;
      socket.join(userRoom);
      console.log(`User ${userId} connected to socket (${socket.id})`);

      // Join session-specific room if session token provided
      if (sessionToken) {
        const sessionRoom = `session:${sessionToken}`;
        socket.join(sessionRoom);
        sessionSocketMap.set(sessionToken, socket.id);
        console.log(`Session ${sessionToken.substring(0, 8)}... joined room`);
      }
    }

    // Handle session check request from client
    socket.on("session:check", async () => {
      if (!userId) {
        socket.emit("session:invalid", { reason: "User not authenticated" });
        return;
      }

      const sessionResult = await validateUserSession(userId);
      if (!sessionResult.valid) {
        socket.emit("session:invalid", { reason: sessionResult.reason });
      } else {
        socket.emit("session:valid");
      }
    });

    socket.on("disconnect", () => {
      console.log(`User ${userId} disconnected from socket (${socket.id})`);
      // Remove from session map
      if (sessionToken) {
        sessionSocketMap.delete(sessionToken);
      }
    });
  });

  console.log("Socket.io initialized");
  return io;
};

/**
 * Get Socket.io instance
 */
export const getIO = (): Server | null => {
  return io;
};

/**
 * Emit permission update event to a specific user
 */
export const emitPermissionsUpdated = (
  userId: number,
  permissions: Array<{
    module_id: number;
    module_key: string;
    can_create: boolean;
    can_read: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }>
): void => {
  if (!io) {
    console.warn("Socket.io not initialized, cannot emit event");
    return;
  }

  const userRoom = `user:${userId}`;
  io.to(userRoom).emit("permissions:updated", { permissions });
  console.log(`Emitted permissions:updated to user ${userId}`);
};

/**
 * Emit session invalid event to a specific user (e.g., when user is deactivated)
 */
export const emitSessionInvalid = (userId: number, reason: string): void => {
  if (!io) {
    console.warn("Socket.io not initialized, cannot emit event");
    return;
  }

  const userRoom = `user:${userId}`;
  io.to(userRoom).emit("session:invalid", { reason });
  console.log(`Emitted session:invalid to user ${userId}: ${reason}`);
};

/**
 * Emit logout event to all sessions of a user EXCEPT the current session
 * Used when user changes password/email and chooses to logout other devices
 */
export const emitLogoutAllSessions = (userId: number, exceptSessionToken: string): void => {
  if (!io) {
    console.warn("Socket.io not initialized, cannot emit event");
    return;
  }

  const userRoom = `user:${userId}`;

  // Get all sockets in the user room
  const userSockets = io.sockets.adapter.rooms.get(userRoom);
  if (!userSockets) {
    console.log(`No sockets found for user ${userId}`);
    return;
  }

  // Emit to each socket except the one in exceptRoom
  userSockets.forEach((socketId) => {
    const socket = io?.sockets.sockets.get(socketId) as AuthenticatedSocket | undefined;
    if (socket && socket.sessionToken !== exceptSessionToken) {
      socket.emit("session:logout_all", {
        reason: "You have been logged out from all other devices",
      });
    }
  });

  console.log(`Emitted session:logout_all to user ${userId} (except session ${exceptSessionToken.substring(0, 8)}...)`);
};

/**
 * Emit logout event to a specific session
 * Used when user revokes a specific session from active sessions list
 */
export const emitLogoutSession = (sessionToken: string): void => {
  if (!io) {
    console.warn("Socket.io not initialized, cannot emit event");
    return;
  }

  const sessionRoom = `session:${sessionToken}`;
  io.to(sessionRoom).emit("session:logout_single", {
    reason: "This session has been revoked",
  });
  console.log(`Emitted session:logout_single to session ${sessionToken.substring(0, 8)}...`);
};
