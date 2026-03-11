import { Router } from "express";
import {
  getAllGlobalClasses,
  // createClass,
  // getClassById,
  // updateClass,
  // deleteClass,
} from "../../../controller/admin/class.controller";
import { storageData } from "../../../utils/services/multer";

const router = Router({ mergeParams: true });

// For global classes list (dropdown): GET /admin/classes
// For school-specific classes: GET /admin/schools/:schoolId/classes
router.get("/", (req, res, next) => {
  return getAllGlobalClasses(req, res, next);
});

// router.post("/", createClass);
// router.get("/:id", getClassById);
// router.put("/:id", updateClass);
// router.delete("/:id", deleteClass);

export default router;
