import { Router } from "express";
import {
  createBadge,
  getAllBadges,
  getBadgeById,
  updateBadge,
  deleteBadge,
} from "../../../controller/admin/badge.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();
const upload = storageData("badges");

router.post("/", checkPermission(ModuleKey.BADGES, PermissionAction.CREATE), upload.single("icon"), createBadge);
router.get("/", checkPermission(ModuleKey.BADGES, PermissionAction.READ), getAllBadges);
router.get("/:id", checkPermission(ModuleKey.BADGES, PermissionAction.READ), getBadgeById);
router.put("/:id", checkPermission(ModuleKey.BADGES, PermissionAction.EDIT), upload.single("icon"), updateBadge);
router.delete("/:id", checkPermission(ModuleKey.BADGES, PermissionAction.DELETE), deleteBadge);

export default router;
