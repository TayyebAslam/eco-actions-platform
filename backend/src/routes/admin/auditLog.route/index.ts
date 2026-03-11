import { Router } from "express";
import {
  getAuditLogs,
  getAuditLogById,
} from "../../../controller/admin/auditLog.controller";

const router = Router();

router.get("/", getAuditLogs);
router.get("/:id", getAuditLogById);

export default router;
