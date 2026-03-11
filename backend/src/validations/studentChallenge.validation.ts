import { z } from "zod";

// Join a challenge - student selects a variant
export const joinChallengeSchema = z.object({
  variant_id: z.coerce.number().min(1, "Variant ID is required"),
});

// Update progress - increment current count
export const updateProgressSchema = z.object({
  increment: z.number().min(1, "Increment must be at least 1").default(1),
});

// Add proof for joined challenge
export const addChallengeProofSchema = z.object({
  photos: z.array(z.string()).min(1, "At least one photo is required"),
});


// Query params for listing challenges
export const listChallengesQuerySchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("10"),
  challenge_type_id: z.string().optional(),
  category_id: z.string().optional(),
  search: z.string().optional(),
});

// Query params for my challenges
export const myChallengesQuerySchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("10"),
  status: z.enum(["in_progress", "completed", "all"]).optional().default("all"),
});
