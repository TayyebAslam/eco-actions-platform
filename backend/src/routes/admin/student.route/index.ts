import { Router } from "express";
import {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  bulkUploadStudents,
} from "../../../controller/admin/student.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";
import multer from "multer";

const router = Router();
const upload = storageData("students");

// Multer configuration for file upload (store in memory for bulk upload)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

router.post("/", checkPermission(ModuleKey.STUDENTS, PermissionAction.CREATE), upload.none(), createStudent);
router.post("/bulk-upload", checkPermission(ModuleKey.STUDENTS, PermissionAction.CREATE), uploadMemory.single("file"), bulkUploadStudents);
router.get("/", checkPermission(ModuleKey.STUDENTS, PermissionAction.READ), getAllStudents);
router.get("/:id", checkPermission(ModuleKey.STUDENTS, PermissionAction.READ), getStudentById);
router.put("/:id", checkPermission(ModuleKey.STUDENTS, PermissionAction.EDIT), upload.none(), updateStudent);
router.delete("/:id", checkPermission(ModuleKey.STUDENTS, PermissionAction.DELETE), deleteStudent);

export default router;
