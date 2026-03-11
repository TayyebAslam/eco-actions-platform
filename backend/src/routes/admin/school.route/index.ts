import { Router } from "express";
import {
  createSchool,
  getAllSchools,
  getSchoolById,
  updateSchool,
  deleteSchool,
  toggleSchoolStatus,
  completeSchoolSetup,
  getAllSchoolsids,
} from "../../../controller/admin/school.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();
const upload = storageData("schools");

// School setup route (for admins who signed up without a school)
router.post("/setup", upload.single("logo"), completeSchoolSetup);

// School CRUD routes (all require admin authentication via middleware in parent router)
router.post(
  "/",
  checkPermission(ModuleKey.SCHOOLS, PermissionAction.CREATE),
  upload.single("logo"),
  createSchool
);
router.get("/", checkPermission(ModuleKey.SCHOOLS, PermissionAction.READ), getAllSchools);

// Public dropdown endpoint (no permission check - used for dropdowns across the app)
router.get("/ids/names", getAllSchoolsids);

router.get("/:id", checkPermission(ModuleKey.SCHOOLS, PermissionAction.READ), getSchoolById);
router.patch(
  "/:id",
  checkPermission(ModuleKey.SCHOOLS, PermissionAction.EDIT),
  upload.single("logo"),
  updateSchool
);
router.delete("/:id", checkPermission(ModuleKey.SCHOOLS, PermissionAction.DELETE), deleteSchool);
router.patch(
  "/:id/toggle-status",
  checkPermission(ModuleKey.SCHOOLS, PermissionAction.EDIT),
  toggleSchoolStatus
);

export default router;
