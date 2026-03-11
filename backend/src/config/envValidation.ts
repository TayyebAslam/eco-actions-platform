import { z } from "zod";

/**
 * Security: Environment variable validation
 * Validates required env vars at startup to fail fast
 */
const envSchema = z.object({
  // Database
  DB_HOST: z.string().min(1, "DB_HOST is required"),
  DB_PORT: z.string().regex(/^\d+$/, "DB_PORT must be a number").transform(Number),
  DB_USER: z.string().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_NAME: z.string().min(1, "DB_NAME is required"),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRE: z.string().default("2d"),

  // Server
  PORT: z.string().regex(/^\d+$/, "PORT must be a number").default("5000").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BASE_URL: z.string().url("BASE_URL must be a valid URL").optional(),

  // Optional but recommended
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 characters").optional(),
  FRONTEND_URL: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let validatedEnv: EnvConfig | null = null;

/**
 * Validate environment variables
 * Call this at application startup
 */
export function validateEnv(): EnvConfig {
  if (validatedEnv) return validatedEnv;

  try {
    validatedEnv = envSchema.parse(process.env);
    console.log("Environment variables validated successfully");
    return validatedEnv;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError<typeof envSchema>;
      const errorMessages = zodError.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`);
      console.error("Environment validation failed:");
      errorMessages.forEach((msg: string) => console.error(`  - ${msg}`));
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Get validated environment config
 */
export function getEnv(): EnvConfig {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}
