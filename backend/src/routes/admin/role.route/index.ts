import { Router } from "express";
import {
  getAllRoles,
  updateRoleDisplayName,
} from "../../../controller/admin/role.controller";
import { storageData } from "../../../utils/services/multer";

const router = Router();
const upload = storageData("role");

// Role routes
router.get("/", getAllRoles);
router.patch("/:id/display-name", upload.none(), updateRoleDisplayName);

export default router;
