import { Router } from "express";
import {
  createChallenge,
  getAllChallenges,
  getChallengeById,
  updateChallenge,
  deleteChallenge,
} from "../../../controller/admin/challenge.controller";
import { storageData } from "../../../utils/services/multer";
import { checkPermission } from "../../../middlewares/permissionMiddleware";
import { ModuleKey, PermissionAction } from "../../../utils/enums/permissions.enum";

const router = Router();
const upload = storageData("challenges");

router.post("/", checkPermission(ModuleKey.CHALLENGES, PermissionAction.CREATE), upload.none(), createChallenge);
router.get("/", checkPermission(ModuleKey.CHALLENGES, PermissionAction.READ), getAllChallenges);
router.get("/:id", checkPermission(ModuleKey.CHALLENGES, PermissionAction.READ), getChallengeById);
router.put("/:id", checkPermission(ModuleKey.CHALLENGES, PermissionAction.EDIT), upload.none(), updateChallenge);
router.delete("/:id", checkPermission(ModuleKey.CHALLENGES, PermissionAction.DELETE), deleteChallenge);

export default router;
