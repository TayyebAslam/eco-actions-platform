import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get or generate encryption key
 * Uses ENCRYPTION_KEY env var, falls back to derived key from JWT_SECRET
 * WARNING: In production, always use a dedicated ENCRYPTION_KEY
 */
const getEncryptionKey = (): Buffer => {
  // Prefer dedicated encryption key
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (encryptionKey) {
    if (encryptionKey.length < 32) {
      throw new Error("ENCRYPTION_KEY must be at least 32 characters long");
    }
    // Use first 32 bytes of the key
    return Buffer.from(encryptionKey.slice(0, 32), "utf-8");
  }

  // Fallback to derived key from JWT_SECRET (not recommended for production)
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      "Either ENCRYPTION_KEY or JWT_SECRET must be set for encryption"
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_KEY must be set in production. " +
        "Falling back to JWT_SECRET is not allowed in production."
    );
  }

  // Derive a key using PBKDF2 (more secure than simple SHA256)
  return crypto.pbkdf2Sync(jwtSecret, "eco-actions-encryption-salt", 100000, 32, "sha256");
};

// Cache the key to avoid repeated derivation
let cachedKey: Buffer | null = null;
const getKey = (): Buffer => {
  if (!cachedKey) {
    cachedKey = getEncryptionKey();
  }
  return cachedKey;
};

/**
 * Encrypts data and returns a URL-safe base64 string
 * @param data - Object to encrypt
 * @returns URL-safe base64 encoded encrypted string
 */
export const encryptData = (data: object): string => {
  if (!data || typeof data !== "object") {
    throw new Error("Data must be a non-null object");
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const jsonData = JSON.stringify(data);
  let encrypted = cipher.update(jsonData, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Combine iv + authTag + encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, "hex"),
  ]);

  // Return URL-safe base64
  return combined.toString("base64url");
};

/**
 * Decrypts URL-safe base64 string back to original data
 * @param encryptedString - The encrypted string to decrypt
 * @returns Decrypted object or null if decryption fails
 */
export const decryptData = <T = object>(encryptedString: string): T | null => {
  if (!encryptedString || typeof encryptedString !== "string") {
    console.error("Decryption failed: Invalid input");
    return null;
  }

  try {
    const key = getKey();

    // Decode from URL-safe base64
    const combined = Buffer.from(encryptedString, "base64url");

    // Validate minimum length (IV + AuthTag + at least 1 byte of data)
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      console.error("Decryption failed: Data too short");
      return null;
    }

    // Extract iv, authTag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted) as T;
  } catch (error) {
    // Don't log the actual error in production (could leak sensitive info)
    if (process.env.NODE_ENV === "development") {
      console.error("Decryption failed:", error);
    } else {
      console.error("Decryption failed");
    }
    return null;
  }
};

/**
 * Validates if a string can be decrypted
 * @param encryptedString - The encrypted string to validate
 * @returns true if the string can be decrypted, false otherwise
 */
export const isValidEncryptedString = (encryptedString: string): boolean => {
  return decryptData(encryptedString) !== null;
};
