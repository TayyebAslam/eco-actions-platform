import { CorsOptions } from "cors";
import dotenv from "dotenv";
dotenv.config();

// Read allowed origins from env (comma-separated)
const getAllowedOrigins = (): string[] => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin !== "");
  }

  // Development fallback
  if (process.env.NODE_ENV === "development") {
    return [
      "http://localhost:3000",
      "http://localhost:5000",
    ];
  }

  // Production: require explicit ALLOWED_ORIGINS
  console.warn(
    "⚠️  WARNING: ALLOWED_ORIGINS not set. CORS will reject all cross-origin requests in production."
  );
  return [];
};

const allowedOrigins = getAllowedOrigins();

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, log rejected origins for debugging
    if (process.env.NODE_ENV === "development") {
      console.warn(`CORS blocked origin: ${origin}`);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-CSRF-Token",
    "X-Session-Token",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 86400, // 24 hours - preflight cache
};

export default corsOptions;
