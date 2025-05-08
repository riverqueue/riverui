import { JobState } from "@services/types";
import { z } from "zod";

export const minimumLimit = 20;
export const defaultLimit = 20;
export const maximumLimit = 200;

// Define default values
export const defaultValues = {
  limit: defaultLimit,
  state: JobState.Running,
};

export const jobSearchSchema = z.object({
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
  state: z.nativeEnum(JobState).default(defaultValues.state),
});
