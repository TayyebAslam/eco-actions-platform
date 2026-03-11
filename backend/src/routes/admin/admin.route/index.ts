import { Router } from "express";
import {
  createAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  toggleAdminStatus,
  changeAdminPassword,
} from "../../../controller/admin/admin.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();
const upload = storageData("admin");

// Admin CRUD routes with permission checks
router.post("/", checkPermission(ModuleKey.ADMINS, PermissionAction.CREATE), upload.none(), createAdmin);
router.get("/", checkPermission(ModuleKey.ADMINS, PermissionAction.READ), getAllAdmins);
router.get("/:id", checkPermission(ModuleKey.ADMINS, PermissionAction.READ), getAdminById);
router.put("/:id", checkPermission(ModuleKey.ADMINS, PermissionAction.EDIT), upload.none(), updateAdmin);
router.delete("/:id", checkPermission(ModuleKey.ADMINS, PermissionAction.DELETE), deleteAdmin);
router.patch("/:id/toggle-status", checkPermission(ModuleKey.ADMINS, PermissionAction.EDIT), toggleAdminStatus);
router.patch("/:id/change-password", checkPermission(ModuleKey.ADMINS, PermissionAction.EDIT), upload.none(), changeAdminPassword);

export default router;
