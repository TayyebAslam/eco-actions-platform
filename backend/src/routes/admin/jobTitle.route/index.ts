import { Router } from "express";
import {
  createJobTitle,
  getAllJobTitles,
  getJobTitleById,
  updateJobTitle,
  deleteJobTitle,
  getJobTitlesForDropdown,
} from "../../../controller/admin/jobTitle.controller";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();

// Job Title CRUD routes
router.post("/", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.CREATE), createJobTitle);
router.get("/", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.READ), getAllJobTitles);
router.get("/dropdown", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.READ), getJobTitlesForDropdown);
router.get("/:id", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.READ), getJobTitleById);
router.put("/:id", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.EDIT), updateJobTitle);
router.delete("/:id", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.DELETE), deleteJobTitle);

export default router;
