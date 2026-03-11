import { Router } from "express";
import {
  createLevel,
  getAllLevels,
  getLevelById,
  updateLevel,
  deleteLevel,
  applyLevelFormula,
} from "../../../controller/admin/level.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();
const upload = storageData("levels");

router.post("/", checkPermission(ModuleKey.LEVELS, PermissionAction.CREATE), upload.none(), createLevel);
router.get("/", checkPermission(ModuleKey.LEVELS, PermissionAction.READ), getAllLevels);
router.get("/:id", checkPermission(ModuleKey.LEVELS, PermissionAction.READ), getLevelById);
router.put("/:id", checkPermission(ModuleKey.LEVELS, PermissionAction.EDIT), upload.none(), updateLevel);
router.post("/apply-formula", checkPermission(ModuleKey.LEVELS, PermissionAction.EDIT), upload.none(), applyLevelFormula);
router.delete("/:id", checkPermission(ModuleKey.LEVELS, PermissionAction.DELETE), deleteLevel);

export default router;
