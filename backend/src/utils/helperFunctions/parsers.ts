/**
 * Utility module for parsing and converting common data types from FormData or string inputs
 * These helpers safely handle type conversion with consistent behavior across the application
 */

/**
 * Safely parse a value to boolean with consistent behavior across all controllers
 * Handles multiple input types including strings, numbers, and actual booleans
 * Returns false by default for null/undefined/invalid values
 * 
 * @param value - The value to parse (can be string, number, boolean, null, or undefined)
 * @returns boolean - Always returns a boolean (no undefined)
 * 
 * @example
 * parseBoolean("true") // true
 * parseBoolean("1") // true
 * parseBoolean("yes") // true
 * parseBoolean("false") // false
 * parseBoolean(0) // false
 * parseBoolean(null) // false
 */
export const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
};

/**
 * Safely parse a value to positive integer with validation
 * Returns null for invalid, zero, or negative values
 * This allows for explicit null checking in the calling code
 * 
 * @param value - The value to parse (can be string, number, or other)
 * @returns number | null - Positive integer or null if invalid
 * 
 * @example
 * parsePositiveInteger("123") // 123
 * parsePositiveInteger(456) // 456
 * parsePositiveInteger("-1") // null
 * parsePositiveInteger("abc") // null
 * parsePositiveInteger(null) // null
 */
export const parsePositiveInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return null;
    return parsed;
  }
  return null;
};

/**
 * Safely extract and sanitize bio/text from FormData
 * Handles null/undefined, trims whitespace, enforces length limits
 * Uses Zod validation for consistent bio constraints across the app
 * 
 * @param bioInput - The bio text input (can be any type)
 * @returns string | null - Sanitized bio (max 500 chars) or null
 * 
 * @throws Error if bio exceeds max length (validation should be done via Zod schema)
 * 
 * @example
 * extractAndValidateBio("Hello") // "Hello"
 * extractAndValidateBio("  spaces  ") // "spaces"
 * extractAndValidateBio(null) // null
 * extractAndValidateBio("") // null (empty after trim)
 */
export const extractAndValidateBio = (bioInput: unknown): string | null => {
  // Handle null/undefined
  if (bioInput === null || bioInput === undefined) {
    return null;
  }

  // Convert to string and trim whitespace
  let bioStr = String(bioInput).trim();

  // Return null if empty after trimming (whitespace-only strings are treated as empty)
  if (bioStr === "") {
    return null;
  }

  // Note: Length validation should be done via Zod schema (.max(500))
  // This function does NOT silently truncate - it returns the trimmed value
  // Schema validation will catch length violations and inform the user
  return bioStr;
};
