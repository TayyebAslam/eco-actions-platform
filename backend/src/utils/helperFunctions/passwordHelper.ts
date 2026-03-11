import crypto from "crypto";

/**
 * Fisher-Yates shuffle for uniform distribution
 */
function fisherYatesShuffle(arr: string[]): string[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    const temp = arr[i];
    arr[i] = arr[j] as string;
    arr[j] = temp as string;
  }
  return arr;
}

/**
 * Generate a random password that meets complexity requirements
 * Contains uppercase, lowercase, digit, and special character
 */
export function generatePassword(length = 12): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "@$!%*?&#";
  const all = upper + lower + digits + special;

  // Ensure at least one of each required type
  let password = "";
  password += upper[crypto.randomInt(upper.length)];
  password += lower[crypto.randomInt(lower.length)];
  password += digits[crypto.randomInt(digits.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += all[crypto.randomInt(all.length)];
  }

  // Shuffle with Fisher-Yates for uniform distribution
  return fisherYatesShuffle(password.split("")).join("");
}
