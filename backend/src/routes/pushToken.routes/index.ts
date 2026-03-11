import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware";
import {
  registerToken,
  unregisterToken,
} from "../../controller/pushToken.controller";

const router = Router();

router.post("/register", authMiddleware, registerToken);
router.post("/unregister", authMiddleware, unregisterToken);

export default router;
