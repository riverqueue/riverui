import { Filter, FilterTypeId } from "@components/job-search/JobSearch";
import { AVAILABLE_FILTERS } from "@components/job-search/types";
import {
  DeadLetterJobFilters,
  defaultDeadLetterJobsLimit,
  maximumDeadLetterJobsLimit,
} from "@services/deadLetterJobs";
import { z } from "zod";

const values = z.union([z.string(), z.array(z.string())]).transform((value) => {
  const result = [...new Set(Array.isArray(value) ? value : [value])]
    .filter(Boolean)
    .sort();
  return result.length ? result : undefined;
});
const strings = values
  .pipe(z.array(z.string().max(1024)).max(100).optional())
  .optional();
const ids = values
  .pipe(
    z
      .array(
        z
          .string()
          .regex(/^[1-9]\d*$/, "Job IDs must be positive integers.")
          .refine(
            (id) =>
              /^[1-9]\d*$/.test(id) &&
              id.length <= 19 &&
              BigInt(id) <= 9223372036854775807n,
            "Job ID is too large.",
          ),
      )
      .max(1000)
      .optional(),
  )
  .optional();
const priorities = values
  .pipe(
    z
      .array(z.string().regex(/^[1-4]$/, "Priorities must be between 1 and 4."))
      .max(4)
      .optional(),
  )
  .optional();

export const deadLetterJobSearchSchema = z.object({
  id: ids,
  kind: strings,
  limit: z.coerce
    .number()
    .int()
    .min(defaultDeadLetterJobsLimit)
    .max(maximumDeadLetterJobsLimit)
    .default(defaultDeadLetterJobsLimit)
    .catch(defaultDeadLetterJobsLimit),
  priority: priorities,
  queue: strings,
  tags: strings,
});

export type DeadLetterJobSearch = z.output<typeof deadLetterJobSearchSchema>;

// The route drops a filter it can't parse, as the Jobs list does, so that a
// hand-edited or stale URL still opens the list. Edits in the search field
// use the strict schema above and show the problem instead.
export const deadLetterJobRouteSearchSchema = deadLetterJobSearchSchema.extend({
  id: ids.catch(undefined),
  kind: strings.catch(undefined),
  priority: priorities.catch(undefined),
  queue: strings.catch(undefined),
  tags: strings.catch(undefined),
});

export const searchToDeadLetterFilters = (
  search: DeadLetterJobSearch,
): DeadLetterJobFilters => ({
  ids: search.id,
  kinds: search.kind,
  priorities: search.priority,
  queues: search.queue,
  tags: search.tags,
});

export const searchToInputFilters = (search: DeadLetterJobSearch): Filter[] =>
  AVAILABLE_FILTERS.flatMap((filter) => {
    const values = search[filter.id];
    return values?.length
      ? [{ id: filter.id, match: filter.match, typeId: filter.id, values }]
      : [];
  });

export const inputFiltersToSearch = (filters: Filter[]) => {
  const result: Record<FilterTypeId, string[] | undefined> = {
    id: undefined,
    kind: undefined,
    priority: undefined,
    queue: undefined,
    tags: undefined,
  };
  for (const filter of filters) {
    if (filter.values.length) result[filter.typeId] = filter.values;
  }
  return result;
};
