import { Router } from "express";
import {
  getAllChallengeTypes,
} from "../../../controller/admin/challengeType.controller";

const router = Router();

router.get("/", getAllChallengeTypes);

export default router;
