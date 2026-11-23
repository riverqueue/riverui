import { JobState } from "@services/types";
import { z } from "zod";

export const minimumLimit = 20;
export const defaultLimit = 20;
export const maximumLimit = 200;

export type SortOrder = "asc" | "desc";

// Search params kept when moving between job states. Other panes clear
// them when they link to Jobs.
export const retainedJobSearchKeys = [
  "createdAfter",
  "createdBefore",
  "id",
  "kind",
  "limit",
  "priority",
  "queue",
  "sortOrder",
  "tags",
] as const;

// Define default values
export const defaultValues = {
  limit: defaultLimit,
  state: JobState.Running,
};

export const jobSearchSchema = z.object({
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  id: z
    .union([z.string(), z.array(z.string().min(1))])
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const arr = Array.isArray(v) ? v : [v];
      try {
        return arr.map(BigInt);
      } catch {
        return undefined;
      }
    }),
  kind: z
    .union([z.string(), z.array(z.string().min(1))])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  limit: z.coerce
    .number()
    .int()
    .min(minimumLimit)
    .max(maximumLimit)
    .default(defaultValues.limit),
  priority: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const arr = Array.isArray(v) ? v : [v];
      // Validate that all values are valid integers
      if (arr.some((p) => isNaN(parseInt(p, 10)))) return undefined;
      return arr;
    }),
  queue: z
    .union([z.string(), z.array(z.string().min(1))])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .transform((v) => v as SortOrder | undefined),
  state: z.nativeEnum(JobState).default(defaultValues.state),
  tags: z
    .union([z.string(), z.array(z.string().min(1))])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
});
