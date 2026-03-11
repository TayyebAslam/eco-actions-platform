import { Router } from "express";
import multer from "multer";
import {
  getAllModules,
  getUserPermissions,
  updateUserPermissions,
} from "../../../controller/admin/permission.controller";

const router = Router();
const upload = multer();

// Module routes
router.get("/modules", getAllModules);

// User permission routes
router.get("/users/:id/permissions", getUserPermissions);
router.put("/users/:id/permissions", upload.none(), updateUserPermissions);

export default router;
