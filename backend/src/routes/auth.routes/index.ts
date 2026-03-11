import { Router } from "express";
import { AUTH } from "../../utils/enums/auth.enum";
import {
  adminLogin,
  adminSignup,
  changePassword,
  checkSession,
  deleteAccount,
  forgetPassword,
  googleLogin,
  login,
  logout,
  resendOTP,
  resendVerificationEmail,
  resetPassword,
  verifyEmail,
  verifyResetToken,
} from "../../controller/auth.controller";
import { storageData } from "../../utils/services/multer";
import { authMiddleware } from "../../middlewares/authMiddleware";
import {
  otpLimiter,
  passwordResetLimiter,
  failedLoginIpBlocker,
  authLimiter,
  loginAccountLimiter,
} from "../../middlewares/requestlimit";

const router = Router();

const upload = storageData("user");

// Admin signup & email verification (rate limited)
router.post(AUTH.ADMIN_SIGNUP, authLimiter, upload.none(), adminSignup);
router.get(AUTH.VERIFY_EMAIL, otpLimiter, verifyEmail);
router.post(AUTH.RESEND_VERIFICATION, otpLimiter, upload.none(), resendVerificationEmail);

// Login routes (strict rate limiting - both per IP and per account)
router.post(
  AUTH.LOGIN_USER,
  authLimiter,
  loginAccountLimiter,
  failedLoginIpBlocker,
  upload.none(),
  login
);
router.post(AUTH.GOOGLE_LOGIN, authLimiter, upload.none(), googleLogin);
router.post(
  AUTH.LOGIN_ADMIN,
  authLimiter,
  loginAccountLimiter,
  failedLoginIpBlocker,
  upload.none(),
  adminLogin
);
router.post(AUTH.LOGOUT, upload.none(), logout);
router.post(AUTH.RESEND_TOKEN, otpLimiter, upload.none(), resendOTP);

// Password reset routes (very strict rate limiting)
router.post(AUTH.FORGOT_PASSWORD, passwordResetLimiter, upload.none(), forgetPassword);
router.get(AUTH.VERIFY_RESET_TOKEN, passwordResetLimiter, verifyResetToken);
router.put(AUTH.RESET_PASSWORD, passwordResetLimiter, upload.none(), resetPassword);

// Protected routes (no additional rate limiting needed - already authenticated)
router.delete(AUTH.DELETE_ACCOUNT, authMiddleware, deleteAccount);
router.put(AUTH.CHANGE_PASSWORD, authMiddleware, upload.none(), changePassword);

// Session check endpoint - validates JWT and returns user if valid, 401 if expired/invalid
router.get("/check-session", authMiddleware, checkSession);

export default router;
