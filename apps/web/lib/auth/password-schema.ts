import { z } from "zod";

/** Signup / silent-registration password rules (matches signup UI). */
export const signupPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must include at least one letter")
  .regex(/[0-9]/, "Password must include at least one number");

/** Account password change rules (profile / reset flows). */
export const accountPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    "Include upper, lower, number, and special character",
  );
