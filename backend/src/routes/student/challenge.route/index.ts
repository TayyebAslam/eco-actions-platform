import { Router } from "express";
import {
  getChallenges,
  getChallengeById,
  joinChallenge,
  leaveChallenge,
  updateProgress,
  addChallengeProof,
  getMyChallenges,
  getJoinedChallenges,
} from "../../../controller/student/challenge.controller";
import { storageData } from "../../../utils/services/multer";

const router = Router();
const upload = storageData("activities");

// Get student's joined challenges
router.get("/my-challenges", getMyChallenges);
router.get("/joined-challenges", getJoinedChallenges);

// Get all active challenges
router.get("/", getChallenges);

// Get challenge by ID
router.get("/:id", getChallengeById);

// Join a challenge
router.post("/:id/join", upload.none(), joinChallenge);
router.delete("/:id/leave", leaveChallenge);

// Update progress
router.put("/progress/:progressId", updateProgress);

// Add proof photo for joined challenge
router.post("/progress/:progressId/proof", upload.array("photos"), addChallengeProof);

export default router;
