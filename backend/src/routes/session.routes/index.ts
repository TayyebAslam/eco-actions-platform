import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware";
import {
  getActiveSessions,
  revokeSession,
  revokeAllSessions,
  handleSessionResponse,
} from "../../controller/session.controller";
import { storageData } from "../../utils/services/multer";

const router = Router();
const upload = storageData("sessions");

// All session routes require authentication
router.use(authMiddleware);

// GET /sessions - Get all active sessions
router.get("/", getActiveSessions);

// DELETE /sessions/:id - Revoke a specific session
router.delete("/:id", revokeSession);

// DELETE /sessions/all - Revoke all sessions except current
router.delete("/all", revokeAllSessions);

// POST /sessions/respond - Handle password/email change response
router.post("/respond", upload.none(), handleSessionResponse);

export default router;
