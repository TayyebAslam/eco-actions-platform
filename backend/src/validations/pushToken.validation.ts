import { z } from "zod";

const fcmTokenField = z
  .string()
  .min(1, "FCM token is required")
  .max(500, "FCM token is too long")
  .regex(/^[A-Za-z0-9_:%-]+$/, "Invalid FCM token format");

export const registerTokenSchema = z.object({
  token: fcmTokenField,
  device_type: z.enum(["web", "android", "ios"]).optional().default("web"),
  device_name: z.string().max(255).optional(),
});

export const unregisterTokenSchema = z.object({
  token: fcmTokenField,
});
