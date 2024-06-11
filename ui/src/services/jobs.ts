import type { MutationFunction, QueryFunction } from "@tanstack/react-query";

import type {
  JobState,
  SnakeToCamelCase,
  StringEndingWithUnderscoreAt,
} from "./types";
import { API } from "@utils/api";

// Represents AttemptError as received from the API. This just like AttemptError,
// except with keys as snake_case instead of camelCase.
type AttemptErrorFromAPI = {
  at: string;
  attempt: number;
  error: string;
  trace: string;
};

export type AttemptError = {
  [Key in keyof AttemptErrorFromAPI as SnakeToCamelCase<Key>]: Key extends `at`
    ? Date
    : AttemptErrorFromAPI[Key];
};

type KnownMetadata = {
  deps: string[];
  task: string;
  workflow_id: string;
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

export type Job = {
  [Key in keyof JobFromAPI as SnakeToCamelCase<Key>]: Key extends
    | StringEndingWithUnderscoreAt
    | undefined
    ? Date
    : JobFromAPI[Key] extends AttemptErrorFromAPI[]
      ? AttemptError[]
      : JobFromAPI[Key];
};

export type JobWithKnownMetadata = Job & {
  metadata: KnownMetadata;
};

export const apiJobToJob = (job: JobFromAPI): Job => ({
  args: job.args,
  attempt: job.attempt,
  attemptedAt: job.attempted_at ? new Date(job.attempted_at) : undefined,
  attemptedBy: job.attempted_by,
  createdAt: new Date(job.created_at),
  errors: apiAttemptErrorsToAttemptErrors(job.errors),
  finalizedAt: job.finalized_at ? new Date(job.finalized_at) : undefined,
  id: job.id,
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
  errors: AttemptErrorFromAPI[]
): AttemptError[] => {
  return errors.map((error) => ({
    attempt: error.attempt,
    at: new Date(error.at),
    error: error.error,
    trace: error.trace,
  }));
};

type JobIdsPayload = {
  ids: bigint[];
};

type CancelPayload = JobIdsPayload;

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

type ListJobsFilters = {
  limit?: number;
  state?: JobState;
};

type ListJobsKey = ["listJobs", ListJobsFilters];

export const listJobsKey = (args: ListJobsFilters): ListJobsKey => {
  return ["listJobs", args];
};

export const listJobs: QueryFunction<Job[], ListJobsKey> = async ({
  queryKey,
  signal,
}) => {
  const [, searchParams] = queryKey;
  const searchParamsStringValues = Object.fromEntries(
    Object.entries(searchParams).map(([k, v]) => [k, String(v)])
  );
  const query = new URLSearchParams(searchParamsStringValues);

  return API.get<JobFromAPI[]>({ path: "/jobs", query }, { signal }).then(
    // Map from JobFromAPI to Job:
    // TODO: there must be a cleaner way to do this given the type definitions?
    (response) => response.map(apiJobToJob)
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
