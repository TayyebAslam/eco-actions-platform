import express, { Express, Request, Response } from "express";
import { createServer } from "http";
import { format } from "util";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morganMiddleware from "./config/morgan";
import corsOptions from "./config/cors";
import Routes from "./routes";
import { dbConnection } from "./config/dbConnection";
import db from "./config/db";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";
import Logger from "./utils/logger";
import { initializeSocket } from "./utils/services/socket";
import { initRedis, closeRedis, isRedisConnected } from "./utils/services/redis";
import { setCsrfToken, validateCsrfToken } from "./middlewares/csrfMiddleware";
import { errorHandler } from "./middlewares/errorHandler";

dotenv.config();

// Create logs directory if it doesn't exist
if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}

// Override console methods to use Logger
// This ensures developers can use console.log(), but it respects LOG_LEVEL and writes to files.
// Can be controlled via ENABLE_CONSOLE_LOG environment variable
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

const enableConsoleLog = process.env.ENABLE_CONSOLE_LOG !== "false";

if (enableConsoleLog) {
  console.log = (message?: unknown, ...optionalParams: unknown[]) => {
    Logger.info(format(message, ...optionalParams));
  };

  console.error = (message?: unknown, ...optionalParams: unknown[]) => {
    Logger.error(format(message, ...optionalParams));
  };
} else {
  // Disable console.log and console.error
  console.log = () => { };
  console.error = () => { };
}

const app: Express = express();

// Security middleware - must be first
const isProduction = process.env.NODE_ENV === "production";

// Get allowed origins for CSP
const getAllowedOriginsForCSP = (): string[] => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  }
  return ["http://localhost:3000", "http://localhost:5000"];
};
const cspOrigins = getAllowedOriginsForCSP();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      connectSrc: ["'self'", ...cspOrigins, "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      imgSrc: ["'self'", "data:", "https:", ...cspOrigins],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Required for Swagger UI
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resource loading
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  noSniff: true,
  xssFilter: true,
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions Policy (replaces Feature Policy)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(morganMiddleware);

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static("public"));

// CSRF Protection
app.use(setCsrfToken); // Set CSRF token cookie on all requests
app.use("/api/v1", validateCsrfToken); // Validate CSRF token on API routes

// Endpoint to get CSRF token for SPAs
app.get("/api/v1/csrf-token", (req, res) => {
  res.json({
    success: true,
    csrfToken: req.cookies.csrf_token
  });
});

const port = process.env.PORT || 5000;

// connection method for chek DB connection
dbConnection();

app.use("/api/v1", Routes);

// Swagger Documentation - Protected in production
if (process.env.NODE_ENV !== "production") {
  // Development/Staging: Swagger accessible without auth
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      swaggerOptions: {
        withCredentials: true,
      },
    })
  );
} else {
  // Production: Swagger requires basic auth or is disabled
  const swaggerUser = process.env.SWAGGER_USER;
  const swaggerPass = process.env.SWAGGER_PASSWORD;

  if (swaggerUser && swaggerPass) {
    // Basic auth for Swagger in production
    app.use("/api-docs", (req, res, next) => {
      const auth = req.headers.authorization;

      if (!auth || !auth.startsWith("Basic ")) {
        res.setHeader("WWW-Authenticate", 'Basic realm="Swagger Documentation"');
        return res.status(401).json({ message: "Authentication required" });
      }

      const credentials = Buffer.from(auth.slice(6), "base64").toString();
      const [user, pass] = credentials.split(":");

      if (user === swaggerUser && pass === swaggerPass) {
        return next();
      }

      res.setHeader("WWW-Authenticate", 'Basic realm="Swagger Documentation"');
      return res.status(401).json({ message: "Invalid credentials" });
    });

    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        swaggerOptions: {
          withCredentials: true,
        },
      })
    );
  } else {
    // Swagger disabled in production if no credentials set
    app.use("/api-docs", (req, res) => {
      res.status(404).json({
        message: "API documentation not available in production",
      });
    });
  }
}

// Health check endpoint for load balancers/Kubernetes
app.get("/health", async (req: Request, res: Response) => {
  const healthcheck: {
    status: string;
    timestamp: string;
    uptime: number;
    environment: string;
    checks: {
      database: string;
      redis: string;
    };
  } = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    checks: {
      database: "checking...",
      redis: "checking...",
    },
  };

  let hasError = false;

  // Check database
  try {
    await db.raw("SELECT 1");
    healthcheck.checks.database = "healthy";
  } catch (error) {
    healthcheck.checks.database = "unhealthy";
    hasError = true;
  }

  // Check Redis
  healthcheck.checks.redis = isRedisConnected() ? "healthy" : "unhealthy";
  if (!isRedisConnected()) {
    // Redis being down is not critical - app can still work
    healthcheck.checks.redis = "disconnected (non-critical)";
  }

  if (hasError) {
    healthcheck.status = "ERROR";
    return res.status(503).json(healthcheck);
  }

  return res.status(200).json(healthcheck);
});

app.get("/", async (req: Request, res: Response) => {
  // Don't expose environment info in production
  const envDisplay = process.env.NODE_ENV === "production" ? "" : ` (${(process.env.NODE_ENV || "development").toUpperCase()})`;
  res.send(`
    <head>
      <link rel="icon" type="image/png" href="/assets/favicon.png">
      <title>${process.env.APP_NAME || "Thrive"}</title>
    </head>
    <body>
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
        <img src="/assets/logo.png" alt="Logo" style="max-width: 200px; margin-bottom: 20px;">
        <h3>SERVER IS RUNNING${envDisplay}</h3>
      </div>
    </body>
  `);
});

app.use((req: Request, res: Response) => {
  res
    .status(404)
    .json({ status: 404, success: false, message: "Route not found" });
});

// Global error handler - must be after all routes
app.use(errorHandler);

// Create HTTP server and initialize Socket.io
const httpServer = createServer(app);
httpServer.setMaxListeners(20); // Socket.io + graceful shutdown add multiple listeners
initializeSocket(httpServer);

// Initialize Redis (non-blocking - app works without Redis)
initRedis().then((connected) => {
  if (!connected) {
    console.warn("⚠️  Redis not connected. Caching disabled. App will still work.");
  }
}).catch((err) => {
  console.warn("⚠️  Redis initialization error:", err.message);
});

// Initialize Firebase (non-blocking - app works without Firebase)
import { initializeFirebase } from "./config/firebase";
try {
  initializeFirebase();
} catch (err: unknown) {
  console.warn("⚠️  Firebase initialization error:", err instanceof Error ? err.message : err);
}

const server = httpServer.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    console.log("HTTP server closed");

    try {
      // Close Redis connection
      await closeRedis();
      console.log("Redis connection closed");
    } catch (err) {
      console.error("Error closing Redis:", err);
    }

    try {
      // Close database connections
      await db.destroy();
      console.log("Database connections closed");
    } catch (err) {
      console.error("Error closing database:", err);
    }

    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
