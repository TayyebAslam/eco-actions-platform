const multer = require("multer");
import fs from "fs";
import { Request } from "express";

// Security: Allowed file types per upload category
const ALLOWED_TYPES: Record<string, { mimes: string[]; extensions: string[] }> = {
  avatars: {
    mimes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  },
  articles: {
    mimes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  },
  activities: {
    mimes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  },
  teachers: {
    mimes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  },
  schools: {
    mimes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  },
  badges: {
    mimes: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
  },
  documents: {
    mimes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    extensions: [".pdf", ".doc", ".docx"],
  },
};

// Security: File size limits per category (in bytes)
const SIZE_LIMITS: Record<string, number> = {
  avatars: 2 * 1024 * 1024,      // 2MB
  articles: 5 * 1024 * 1024,     // 5MB
  activities: 5 * 1024 * 1024,   // 5MB
  teachers: 2 * 1024 * 1024,     // 2MB
  schools: 5 * 1024 * 1024,      // 5MB
  badges: 1 * 1024 * 1024,       // 1MB
  documents: 10 * 1024 * 1024,   // 10MB
  default: 5 * 1024 * 1024,      // 5MB default
};

export const storageData = (name: string) => {
  const storage = multer.diskStorage({
    destination: (req: Request, file: File, cb: CallableFunction) => {
      const path = `public/${name}`;
      try {
        fs.mkdirSync(path, { recursive: true });
        cb(null, path);
      } catch (err: unknown) {
        cb(err instanceof Error ? err.message : "Unknown error", null);
      }
    },
    filename: (
      req: Request,
      file: { originalname: string },
      cb: CallableFunction
    ) => {
      // Security: Sanitize filename and prevent path traversal
      const sanitizedName =
        typeof file.originalname === "string"
          ? file.originalname
              .replace(/[^\w.-]/g, "_")  // Remove special chars except . and -
              .replace(/\.{2,}/g, ".")    // Prevent multiple dots (path traversal)
              .toLowerCase()
          : "file";
      cb(null, Date.now() + "-" + sanitizedName);
    },
  });

  // Security: File filter to validate MIME type and extension
  const fileFilter = (
    req: Request,
    file: { mimetype: string; originalname: string },
    cb: CallableFunction
  ) => {
    const allowedConfig = ALLOWED_TYPES[name] ?? ALLOWED_TYPES["activities"]!;
    const extension = "." + file.originalname.split(".").pop()?.toLowerCase();

    // Validate MIME type
    if (!allowedConfig.mimes.includes(file.mimetype)) {
      return cb(
        new Error(`Invalid file type. Allowed types: ${allowedConfig.extensions.join(", ")}`),
        false
      );
    }

    // Validate extension
    if (!allowedConfig.extensions.includes(extension)) {
      return cb(
        new Error(`Invalid file extension. Allowed: ${allowedConfig.extensions.join(", ")}`),
        false
      );
    }

    cb(null, true);
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: SIZE_LIMITS[name] || SIZE_LIMITS.default,
      files: 10,  // Max 10 files per request
    },
  });

  return upload;
};
