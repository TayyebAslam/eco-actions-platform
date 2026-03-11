import { Router } from "express";
import {
  getAllActivities,
  getActivityById,
  reviewActivity,
} from "../../../controller/admin/activity.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();
const upload = storageData("activities");

router.get("/", checkPermission(ModuleKey.ACTIVITIES, PermissionAction.READ), getAllActivities);
router.get("/:id", checkPermission(ModuleKey.ACTIVITIES, PermissionAction.READ), getActivityById);
router.post("/:id/review", checkPermission(ModuleKey.ACTIVITIES, PermissionAction.EDIT), upload.none(), reviewActivity);


export default router;
