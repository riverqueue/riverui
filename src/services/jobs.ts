import type { MutationFunction, QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import type {
  JobState,
  SnakeToCamelCase,
  StringEndingWithUnderscoreAt,
} from "./types";

import { ListResponse } from "./listResponse";

export type AttemptError = {
  [Key in keyof AttemptErrorFromAPI as SnakeToCamelCase<Key>]: Key extends `at`
    ? Date
    : AttemptErrorFromAPI[Key];
};

export type Job = {
  [Key in keyof JobFromAPI as SnakeToCamelCase<Key>]: Key extends
    | StringEndingWithUnderscoreAt
    | undefined
    ? Date
    : JobFromAPI[Key] extends AttemptErrorFromAPI[]
      ? AttemptError[]
      : JobFromAPI[Key];
};

// Represents a Job as received from the API. This just like Job, except with
// string dates instead of Date objects and keys as snake_case instead of
// camelCase.
export type JobFromAPI = {
  args: object;
  attempt: number;
  attempted_at?: string;
  attempted_by: string[];
  created_at: string;
  errors: AttemptErrorFromAPI[];
  finalized_at?: string;
  id: bigint;
  kind: string;
  max_attempts: number;
  metadata: KnownMetadata | object;
  priority: number;
  queue: string;
  scheduled_at: string;
  state: JobState;
  tags: string[];
};

export type JobWithKnownMetadata = {
  metadata: KnownMetadata;
} & Omit<Job, "metadata">;

// Represents AttemptError as received from the API. This just like AttemptError,
// except with keys as snake_case instead of camelCase.
type AttemptErrorFromAPI = {
  at: string;
  attempt: number;
  error: string;
  trace: string;
};

type KnownMetadata = {
  deps: string[];
  task: string;
  workflow_id: string;
  workflow_name?: string;
  workflow_staged_at: string;
};

export const apiJobToJob = (job: JobFromAPI): Job => ({
  args: job.args,
  attempt: job.attempt,
  attemptedAt: job.attempted_at ? new Date(job.attempted_at) : undefined,
  attemptedBy: job.attempted_by,
  createdAt: new Date(job.created_at),
  errors: apiAttemptErrorsToAttemptErrors(job.errors),
  finalizedAt: job.finalized_at ? new Date(job.finalized_at) : undefined,
  id: BigInt(job.id),
  kind: job.kind,
  maxAttempts: job.max_attempts,
  metadata: job.metadata,
  priority: job.priority,
  queue: job.queue,
  scheduledAt: new Date(job.scheduled_at),
  state: job.state,
  tags: job.tags,
});

const apiAttemptErrorsToAttemptErrors = (
  errors: AttemptErrorFromAPI[],
): AttemptError[] => {
  return errors.map((error) => ({
    at: new Date(error.at),
    attempt: error.attempt,
    error: error.error,
    trace: error.trace,
  }));
};

type CancelPayload = JobIdsPayload;

type JobIdsPayload = {
  ids: bigint[];
};

export const cancelJobs: MutationFunction<void, CancelPayload> = async ({
  ids,
}) => {
  return API.post("/jobs/cancel", JSON.stringify({ ids: ids.map(String) }));
};

type DeletePayload = JobIdsPayload;

export const deleteJobs: MutationFunction<void, DeletePayload> = async ({
  ids,
}) => {
  return API.post("/jobs/delete", JSON.stringify({ ids: ids.map(String) }));
};

export type ListJobsKey = ["listJobs", JobState, number];

type ListJobsFilters = {
  limit: number;
  state: JobState;
};

export const listJobsKey = (args: ListJobsFilters): ListJobsKey => {
  return ["listJobs", args.state, args.limit];
};

export const listJobs: QueryFunction<Job[], ListJobsKey> = async ({
  queryKey,
  signal,
}) => {
  const [, state, limit] = queryKey;
  const searchParamsStringValues = Object.fromEntries(
    Object.entries({ limit, state }).map(([k, v]) => [k, String(v)]),
  );
  const query = new URLSearchParams(searchParamsStringValues);

  // TODO: Update API to support filtering by kind, priority, and queue
  // The UI now supports these filters but the API doesn't yet accept them
  // We'll need to:
  // 1. Update the API endpoint to accept these filter parameters
  // 2. Update the query parameters here to include them
  // 3. Update the ListJobsKey type to include the filter values
  return API.get<ListResponse<JobFromAPI>>(
    { path: "/jobs", query },
    { signal },
  ).then(
    // Map from JobFromAPI to Job:
    // TODO: there must be a cleaner way to do this given the type definitions?
    (response) => response.data.map(apiJobToJob),
  );
};

type GetJobKey = ["getJob", string];

export const getJobKey = (id: bigint): GetJobKey => {
  return ["getJob", id.toString()];
};

export const getJob: QueryFunction<Job, GetJobKey> = async ({
  queryKey,
  signal,
}) => {
  const [, jobID] = queryKey;
  return (
    API.get<JobFromAPI>({ path: `/jobs/${jobID}` }, { signal })
      // Map from JobFromAPI to Job:
      .then(apiJobToJob)
  );
};

type RetryPayload = JobIdsPayload;

export const retryJobs: MutationFunction<void, RetryPayload> = async ({
  ids,
}) => {
  return API.post("/jobs/retry", JSON.stringify({ ids: ids.map(String) }));
};
