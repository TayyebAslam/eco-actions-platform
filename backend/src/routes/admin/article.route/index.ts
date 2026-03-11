import { Router } from "express";
import {
  createArticle,
  getAllArticles,
  getArticleById,
  updateArticle,
  deleteArticle,
  uploadEditorImage,
  uploadArticleThumbnail,
} from "../../../controller/admin/article.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();
const upload = storageData("articles");

// Image upload endpoints for rich text editor and thumbnails
router.post("/upload-editor-image", checkPermission(ModuleKey.ARTICLES, PermissionAction.CREATE), upload.single("image"), uploadEditorImage);
router.post("/upload-thumbnail", checkPermission(ModuleKey.ARTICLES, PermissionAction.CREATE), upload.single("thumbnail"), uploadArticleThumbnail);

// Article CRUD
router.post("/", checkPermission(ModuleKey.ARTICLES, PermissionAction.CREATE), upload.single("cover_image"), createArticle);
router.get("/", checkPermission(ModuleKey.ARTICLES, PermissionAction.READ), getAllArticles);
router.get("/:id", checkPermission(ModuleKey.ARTICLES, PermissionAction.READ), getArticleById);
router.put("/:id", checkPermission(ModuleKey.ARTICLES, PermissionAction.EDIT), upload.single("cover_image"), updateArticle);
router.delete("/:id", checkPermission(ModuleKey.ARTICLES, PermissionAction.DELETE), deleteArticle);

export default router;
