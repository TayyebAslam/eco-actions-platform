import { z } from "zod";

export const jobTitleDTOSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  school_id: z.number().nullable(),
  created_by: z.number().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const jobTitleListItemDTOSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  school_id: z.number().nullable(),
  school_name: z.string().nullable().optional(),
  created_at: z.date(),
});

export type JobTitleDTO = z.infer<typeof jobTitleDTOSchema>;
export type JobTitleListItemDTO = z.infer<typeof jobTitleListItemDTOSchema>;
