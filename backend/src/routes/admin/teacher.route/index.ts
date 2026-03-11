import { Router } from "express";
import {
  createTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  bulkUploadTeachers,
} from "../../../controller/admin/teacher.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";
import multer from "multer";

const router = Router();
const upload = storageData("teachers");

// Multer configuration for file upload (store in memory for bulk upload)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});

router.post("/", checkPermission(ModuleKey.TEACHERS, PermissionAction.CREATE), upload.none(), createTeacher);
router.post("/bulk-upload", checkPermission(ModuleKey.TEACHERS, PermissionAction.CREATE), uploadMemory.single("file"), bulkUploadTeachers);
router.get("/", checkPermission(ModuleKey.TEACHERS, PermissionAction.READ), getAllTeachers);
router.get("/:id", checkPermission(ModuleKey.TEACHERS, PermissionAction.READ), getTeacherById);
router.put("/:id", checkPermission(ModuleKey.TEACHERS, PermissionAction.EDIT), upload.none(), updateTeacher);
router.delete("/:id", checkPermission(ModuleKey.TEACHERS, PermissionAction.DELETE), deleteTeacher);

export default router;
