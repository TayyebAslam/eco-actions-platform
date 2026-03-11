import swaggerJsdoc from "swagger-jsdoc";
import { apiOrder } from "../docs/apiOrder";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Eco Actions API Documentation",
      version: "1.0.0",
      description: "API documentation for Eco Actions Platform Ecosystem. \n\n **Note**: Cookie authentication is handled automatically by your browser for `httpOnly` cookies. You do not need to configure it in the 'Authorize' button.",
      contact: {
        name: "Eco Actions Team",
      },
    },
    servers: [
      {
        url: "http://localhost:5000/api/v1",
        description: "Local Development Server",
      },

      {
        url: "https://api.eco-actions.com/api/v1",
        description: "Production Server",
      },
    ],
    // 🎯 Tags Order: Jo tag pehle hoga, wo Swagger mein pehle dikhega
    tags: [
      {
        name: "Auth",
        description: "Authentication and authorization endpoints",
      },
      {
        name: "Profile",
        description: "User profile management endpoints",
      },
      {
        name: "Teacher",
        description: "Teacher endpoints - manage school users and resources",
      },
      {
        name: "Teacher - Articles",
        description: "Teacher endpoints for creating and managing articles",
      },
      {
        name: "Student - Challenges",
        description: "Student challenge endpoints - view, join, and track challenge progress",
      },
      {
        name: "Student - Activities",
        description: "Student activity endpoints - create and submit activities",
      },
      {
        name: "Student - Articles",
        description: "Student endpoints for viewing and bookmarking articles",
      },
      {
        name: "Student - Dashboard",
        description: "Student home dashboard endpoint",
      },
      {
        name: "Admin Management",
        description: "Super Admin endpoints for managing school admins and sub admins",
      },
      {
        name: "Admin - Activities",
        description: "Admin endpoints for viewing and managing activities",
      },
      {
        name: "Admin - Articles",
        description: "Admin endpoints for creating and managing articles",
      },
      {
        name: "Admin - Levels",
        description: "Admin endpoints for creating and managing levels",
      },
      {
        name: "Student - Leaderboard",
        description: "Student leaderboard endpoints for students and schools",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your Bearer token here if you are testing independent of cookies (e.g. Mobile App). \n\n **NOTE:** If you are logged in via the Web (Browser), **you do NOT need to enter anything here**. Authentication works automatically via cookies.",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
          description: "Cookie-based authentication (automatic for browser-based requests)",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/docs/routes/*.yaml", "./src/docs/schemas/*.yaml"], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(options) as { paths?: Record<string, unknown> };

// Apply custom API order from src/docs/apiOrder.ts
if (apiOrder.length > 0 && swaggerSpec.paths) {
  const orderedPaths: Record<string, unknown> = {};

  // First, add paths in the order specified
  apiOrder.forEach((path: string) => {
    if (swaggerSpec.paths![path]) {
      orderedPaths[path] = swaggerSpec.paths![path];
    }
  });

  // Then, add any remaining paths that weren't in the order array
  Object.keys(swaggerSpec.paths!).forEach((path: string) => {
    if (!orderedPaths[path]) {
      orderedPaths[path] = swaggerSpec.paths![path];
    }
  });

  swaggerSpec.paths = orderedPaths;
  console.log("✅ Swagger API order applied from src/docs/apiOrder.ts");
}

export default swaggerSpec;
