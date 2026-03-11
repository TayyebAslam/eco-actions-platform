import { Router } from "express";
import {
  createSection,
  getAllSections,
  getSectionById,
  updateSection,
  deleteSection,
} from "../../../controller/admin/section.controller";
import { storageData } from "../../../utils/services/multer";

const router = Router({mergeParams:true});
const upload = storageData("sections");

// Sections are nested under classes: /admin/classes/:classId/sections
router.post("/", upload.none(), createSection);
router.get("/", getAllSections);
router.get("/:id", getSectionById);
router.put("/:id", upload.none(), updateSection);
router.delete("/:id", deleteSection);

export default router;
