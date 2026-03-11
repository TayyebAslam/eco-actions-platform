import { Router } from "express";
import {
  createSchoolRequest,
  initiateSchoolRequest,
  verifySchoolRequestEmail,
  completeSchoolRequest,
  reRegisterSchoolRequest,
} from "../controller/admin/schoolRequest.controller";
import { storageData } from "../utils/services/multer";

const router = Router();
const upload = storageData("schools");

// Multi-step school registration routes
router.post("/initiate", upload.none(), initiateSchoolRequest);
router.get("/verify", verifySchoolRequestEmail);
router.post("/complete", upload.single("school_logo"), completeSchoolRequest);
router.post("/reregister", upload.single("school_logo"), reRegisterSchoolRequest);

// Legacy route for single-step school registration request
router.post("/", upload.single("school_logo"), createSchoolRequest);

export default router;
