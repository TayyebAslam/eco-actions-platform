import { Router } from "express";
import AUTHROUTES from "./auth.routes";
import ADMINROUTES from "./admin";
import PROFILEROUTES from "./profile.routes";
import SCHOOLREQUESTROUTES from "./schoolRequest.routes";
import SESSIONROUTES from "./session.routes";
import STUDENTROUTES from "./student";
import TEACHERROUTES from "./teacher";
import PUSHTOKENROUTES from "./pushToken.routes";

const router = Router();

router.use("/auth", AUTHROUTES);
router.use("/admin", ADMINROUTES);
router.use("/profile", PROFILEROUTES);
router.use("/school-requests", SCHOOLREQUESTROUTES);
router.use("/sessions", SESSIONROUTES);
router.use("/student", STUDENTROUTES);
router.use("/teacher", TEACHERROUTES);
router.use("/push-tokens", PUSHTOKENROUTES);

export default router;
