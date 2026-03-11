import { Router } from "express";
import {
  getAllSchoolRequests,
  approveSchoolRequest,
  rejectSchoolRequest,
} from "../../../controller/admin/schoolRequest.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();
const upload = storageData("school_requests");

// Admin-only routes for viewing and processing school requests
router.get("/", checkPermission(ModuleKey.SCHOOL_REQUESTS, PermissionAction.READ), getAllSchoolRequests);
// Approve/reject are SUPER_ADMIN-only (enforced in controller) — no permission middleware needed
router.post("/:id/approve", upload.none(), approveSchoolRequest);
router.post("/:id/reject", upload.none(), rejectSchoolRequest);

export default router;
