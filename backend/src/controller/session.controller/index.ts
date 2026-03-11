import { Request, Response } from "express";
import asyncHandler from "../../middlewares/trycatch";
import { sendResponse } from "../../utils/helperFunctions/responseHelper";
import { sessionService } from "../../services/session.service";
import { emitLogoutAllSessions, emitLogoutSession } from "../../utils/services/socket";

/**
 * Get all active sessions for the current user
 */
export const getActiveSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const currentSessionToken = req.sessionToken;

  if (!userId) {
    sendResponse(res, 401, "Unauthorized", false);
    return;
  }

  const sessions = await sessionService.getActiveSessions(userId, currentSessionToken);

  sendResponse(res, 200, "Active sessions fetched successfully", true, { sessions });
});

/**
 * Revoke a specific session
 */
export const revokeSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const currentSessionToken = req.sessionToken;
  const sessionId = parseInt(req.params.id as string, 10);

  if (!userId) {
    sendResponse(res, 401, "Unauthorized", false);
    return;
  }

  if (!sessionId || isNaN(sessionId)) {
    sendResponse(res, 400, "Invalid session ID", false);
    return;
  }

  // Get the session to get its token before invalidating
  const sessions = await sessionService.getActiveSessions(userId, currentSessionToken);
  const targetSession = sessions.find((s) => s.id === sessionId);

  if (!targetSession) {
    sendResponse(res, 404, "Session not found", false);
    return;
  }

  if (targetSession.is_current) {
    sendResponse(res, 400, "Cannot revoke current session. Use logout instead.", false);
    return;
  }

  // Get the session token before invalidating
  const sessionTokenToRevoke = targetSession.session_token;

  const success = await sessionService.invalidateSession(sessionId, userId);

  if (!success) {
    sendResponse(res, 404, "Session not found or already revoked", false);
    return;
  }

  // Emit logout event to that session via socket
  if (sessionTokenToRevoke) {
    emitLogoutSession(sessionTokenToRevoke);
  }

  sendResponse(res, 200, "Session revoked successfully", true);
});

/**
 * Revoke all sessions except current
 */
export const revokeAllSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const currentSessionToken = req.sessionToken;

  if (!userId) {
    sendResponse(res, 401, "Unauthorized", false);
    return;
  }

  if (!currentSessionToken) {
    sendResponse(res, 400, "Session token not found", false);
    return;
  }

  const count = await sessionService.invalidateAllSessionsExcept(userId, currentSessionToken);

  // Emit socket event to force logout on all other sessions
  emitLogoutAllSessions(userId, currentSessionToken);

  sendResponse(res, 200, `${count} session(s) revoked successfully`, true, {
    revokedCount: count,
  });
});

/**
 * Handle password/email change response - user decides to logout all or keep all
 */
export const handleSessionResponse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const currentSessionToken = req.sessionToken;
  const { action } = req.body;

  if (!userId) {
    sendResponse(res, 401, "Unauthorized", false);
    return;
  }

  if (!currentSessionToken) {
    sendResponse(res, 400, "Session token not found", false);
    return;
  }

  if (!action || !["logout_all", "keep_all"].includes(action)) {
    sendResponse(res, 400, "Invalid action. Must be 'logout_all' or 'keep_all'", false);
    return;
  }

  if (action === "logout_all") {
    // Invalidate all other sessions
    const count = await sessionService.invalidateAllSessionsExcept(userId, currentSessionToken);

    // Emit socket event to force logout on all other sessions
    emitLogoutAllSessions(userId, currentSessionToken);

    sendResponse(res, 200, `Logged out from ${count} other device(s)`, true, {
      revokedCount: count,
    });
    return;
  }

  // action === 'keep_all' - do nothing, just acknowledge
  sendResponse(res, 200, "All devices will remain signed in", true);
});
