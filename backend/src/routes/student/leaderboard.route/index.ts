import { Router } from "express";
import {
  getSchoolsLeaderboard,
  getStudentLeaderboard,
} from "../../../controller/student/leaderboard.controller";

const router = Router();

router.get("/", getStudentLeaderboard);
router.get("/schools", getSchoolsLeaderboard);

export default router;
