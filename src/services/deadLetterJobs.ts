import type { MutationFunction, QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import { apiJobToJob, Job, JobFromAPI } from "./jobs";
import { ListResponse } from "./listResponse";

export type DeadLetterJobFilters = {
  ids?: string[];
  kinds?: string[];
  priorities?: string[];
  queues?: string[];
  tags?: string[];
};
export type DeadLetterJobListItem = Pick<
  Job,
  "attempt" | "finalizedAt" | "id" | "kind" | "maxAttempts" | "queue"
>;

type DeadLetterJobFromAPI = { id: string } & Omit<JobFromAPI, "id">;

type DeadLetterJobListItemFromAPI = {
  attempt: number;
  finalized_at: null | string;
  id: string;
  kind: string;
  max_attempts: number;
  queue: string;
};

export const defaultDeadLetterJobsLimit = 20;
export const maximumDeadLetterJobsLimit = 200;

const toJob = (job: DeadLetterJobFromAPI): Job =>
  apiJobToJob({ ...job, id: BigInt(job.id) });

export const listDeadLetterJobsKey = (
  limit?: number,
  filters: DeadLetterJobFilters = {},
) =>
  limit === undefined
    ? (["listDeadLetterJobs"] as const)
    : (["listDeadLetterJobs", { ...filters, limit }] as const);
export const getDeadLetterJobKey = (id: bigint) =>
  ["getDeadLetterJob", id.toString()] as const;

export const listDeadLetterJobs: QueryFunction<
  DeadLetterJobListItem[],
  ReturnType<typeof listDeadLetterJobsKey>
> = async ({ queryKey, signal }) => {
  const limit = queryKey[1]?.limit ?? defaultDeadLetterJobsLimit;
  const query = new URLSearchParams({ limit: String(limit) });
  const filters = queryKey[1];
  for (const key of ["ids", "kinds", "priorities", "queues", "tags"] as const) {
    filters?.[key]?.forEach((value) => query.append(key, value));
  }
  const response = await API.get<ListResponse<DeadLetterJobListItemFromAPI>>(
    {
      path: "/pro/dead-letter-jobs",
      query,
    },
    { signal },
  );
  return response.data.map((job) => ({
    attempt: job.attempt,
    finalizedAt: job.finalized_at ? new Date(job.finalized_at) : undefined,
    id: BigInt(job.id),
    kind: job.kind,
    maxAttempts: job.max_attempts,
    queue: job.queue,
  }));
};

export const getDeadLetterJob: QueryFunction<
  Job,
  ReturnType<typeof getDeadLetterJobKey>
> = async ({ queryKey: [, id], signal }) => {
  return toJob(
    await API.get<DeadLetterJobFromAPI>(
      { path: `/pro/dead-letter-jobs/${id}` },
      { signal },
    ),
  );
};

export const retryDeadLetterJob: MutationFunction<Job, bigint> = async (id) => {
  return toJob(
    await API.post<string, DeadLetterJobFromAPI>(
      `/pro/dead-letter-jobs/${id}/retry`,
    ),
  );
};

export async function fetchDeadLetterSuggestions(
  facet: "job_kind" | "queue_name",
  match: string,
  exclude: string[],
  signal?: AbortSignal,
): Promise<string[]> {
  const query = new URLSearchParams({ facet, match });
  exclude.forEach((value) => query.append("exclude", value));
  const response = await API.get<ListResponse<string>>(
    { path: "/pro/dead-letter-jobs/autocomplete", query },
    { signal },
  );
  return response.data;
}
