import { Router } from "express";
import {
  createSystemUser,
  getAllSystemUsers,
  getSystemUserById,
  updateSystemUser,
  deleteSystemUser,
  toggleSystemUserStatus,
  changeSystemUserPassword,
} from "../../../controller/admin/systemUser.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();
const upload = storageData("system-user");

// System User CRUD routes (require permission checks - Super Admin has full access, Admin needs permissions)
router.post("/", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.CREATE), upload.none(), createSystemUser);
router.get("/", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.READ), getAllSystemUsers);
router.get("/:id", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.READ), getSystemUserById);
router.put("/:id", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.EDIT), upload.none(), updateSystemUser);
router.delete("/:id", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.DELETE), deleteSystemUser);
router.patch("/:id/toggle-status", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.EDIT), toggleSystemUserStatus);
router.patch("/:id/change-password", checkPermission(ModuleKey.SYSTEM_USERS, PermissionAction.EDIT), upload.none(), changeSystemUserPassword);

export default router;
