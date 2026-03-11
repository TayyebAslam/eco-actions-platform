import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../../../controller/admin/category.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();
const upload = storageData("categories");

router.post("/", checkPermission(ModuleKey.CATEGORIES, PermissionAction.CREATE), upload.single("icon"), createCategory);
router.get("/", checkPermission(ModuleKey.CATEGORIES, PermissionAction.READ), getAllCategories);
router.get("/:id", checkPermission(ModuleKey.CATEGORIES, PermissionAction.READ), getCategoryById);
router.put("/:id", checkPermission(ModuleKey.CATEGORIES, PermissionAction.EDIT), upload.single("icon"), updateCategory);
router.delete("/:id", checkPermission(ModuleKey.CATEGORIES, PermissionAction.DELETE), deleteCategory);

export default router;
