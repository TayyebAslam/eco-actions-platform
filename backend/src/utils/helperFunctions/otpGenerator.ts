import { randomBytes } from "crypto";

export const generateOTP = (): string => {
  return (
    (parseInt(randomBytes(3).toString("hex"), 16) % 900000) +
    100000
  ).toString();
};
