import jwt, { Algorithm, VerifyOptions } from "jsonwebtoken";
import { config } from "dotenv";

config();

// Validate JWT_SECRET exists and is strong enough
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long");
}

const JWT_ALGORITHM: Algorithm = "HS256";
const JWT_EXPIRE = process.env.JWT_EXPIRE || "2d";

interface TokenPayload {
  id: string;
  iat?: number;
  exp?: number;
}

interface ResetTokenPayload {
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a signed JWT token for user authentication
 */
export const getSignedJwt = (id: number): string => {
  const payload: TokenPayload = { id: id.toString() };

  return jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRE as jwt.SignOptions["expiresIn"],
  });
};

/**
 * Create a reset token for password reset flows
 */
export const createResetToken = (
  payload: { email: string },
  time: string = "10m"
): string => {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: time as jwt.SignOptions["expiresIn"],
  });
};

/**
 * Verify and decode a JWT token
 */
export const verifyToken = (token: string): TokenPayload | ResetTokenPayload => {
  const options: VerifyOptions = {
    algorithms: [JWT_ALGORITHM], // Only accept HS256
  };

  try {
    const decoded = jwt.verify(token, JWT_SECRET, options);
    return decoded as TokenPayload | ResetTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid token");
    }
    throw new Error("Token verification failed");
  }
};

/**
 * Decode token without verification (for debugging only)
 */
export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload | null;
  } catch {
    return null;
  }
};
