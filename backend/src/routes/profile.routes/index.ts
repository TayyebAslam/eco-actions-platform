import { Router } from "express";
import { storageData } from "../../utils/services/multer";
import { authMiddleware } from "../../middlewares/authMiddleware";
import {
  getProfile,
  updateProfile,
  updateProfileImage,
  requestEmailChange,
  confirmEmailChange,
  deleteAccount,
} from "../../controller/profile.controller";

const router = Router();

const upload = storageData("user");

// Profile routes
router.get("/", authMiddleware, getProfile);

router.put(
  "/",
  authMiddleware,
  upload.single("profile_image"),
  updateProfile
);

// Profile image upload route (separate endpoint)
router.put(
  "/image",
  authMiddleware,
  upload.single("profile_image"),
  updateProfileImage
);

// Email change routes
router.post("/request-email-change", authMiddleware, upload.none(), requestEmailChange);
router.put("/confirm-email-change", authMiddleware, upload.none(), confirmEmailChange);

// Delete account route (self-deletion only)
router.delete("/delete-account", authMiddleware, upload.none(), deleteAccount);

export default router;
