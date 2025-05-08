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

export type JobFromAPI = {
  errors: AttemptErrorFromAPI[];
  logs: JobLogs;
  metadata: KnownMetadata | object;
} & JobMinimalFromAPI;

export type JobLogEntry = {
  attempt: number;
  log: string;
};

// New type for better organized logs
export type JobLogs = {
  [attempt: number]: string;
};

export type JobMinimal = {
  [Key in keyof JobMinimalFromAPI as SnakeToCamelCase<Key>]: Key extends
    | StringEndingWithUnderscoreAt
    | undefined
    ? Date
    : JobMinimalFromAPI[Key];
};

// Represents a Job as received from the API. This just like Job, except with
// string dates instead of Date objects and keys as snake_case instead of
// camelCase.
export type JobMinimalFromAPI = {
  args: object;
  attempt: number;
  attempted_at?: string;
  attempted_by: string[];
  created_at: string;
  finalized_at?: string;
  id: bigint;
  kind: string;
  max_attempts: number;
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
  "river:log"?: RiverJobLogEntry[];
  task: string;
  workflow_id: string;
  workflow_name?: string;
  workflow_staged_at: string;
};

type RiverJobLogEntry = {
  attempt: number;
  log: string;
};

export const apiJobMinimalToJobMinimal = (
  job: JobMinimalFromAPI,
): JobMinimal => ({
  args: job.args,
  attempt: job.attempt,
  attemptedAt: job.attempted_at ? new Date(job.attempted_at) : undefined,
  attemptedBy: job.attempted_by,
  createdAt: new Date(job.created_at),
  finalizedAt: job.finalized_at ? new Date(job.finalized_at) : undefined,
  id: BigInt(job.id),
  kind: job.kind,
  maxAttempts: job.max_attempts,
  priority: job.priority,
  queue: job.queue,
  scheduledAt: new Date(job.scheduled_at),
  state: job.state,
  tags: job.tags,
});

export const apiJobToJob = (job: JobFromAPI): Job => ({
  ...apiJobMinimalToJobMinimal(job),
  errors: apiAttemptErrorsToAttemptErrors(job.errors),
  logs: extractJobLogs(job.metadata),
  metadata: job.metadata,
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

// Helper function to extract river:log entries from job metadata
const extractJobLogs = (metadata: object): JobLogs => {
  if (
    metadata &&
    typeof metadata === "object" &&
    "river:log" in metadata &&
    Array.isArray(metadata["river:log"])
  ) {
    const riverLogs = metadata["river:log"] as RiverJobLogEntry[];

    return riverLogs.reduce<JobLogs>((acc, entry) => {
      const attemptLogs = acc[entry.attempt] || "";

      return {
        ...acc,
        [entry.attempt]: attemptLogs + entry.log,
      };
    }, {});
  }

  return {};
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

export type ListJobsKey = [
  "listJobs",
  {
    ids: bigint[] | undefined;
    kinds: string[] | undefined;
    limit: number;
    priorities: number[] | undefined;
    queues: string[] | undefined;
    state: JobState | undefined;
  },
];

type ListJobsFilters = {
  ids?: bigint[];
  kinds?: string[];
  limit: number;
  priorities?: number[];
  queues?: string[];
  state?: JobState;
};

export const listJobsKey = (args: ListJobsFilters): ListJobsKey => {
  return [
    "listJobs",
    {
      ids: args.ids,
      kinds: args.kinds,
      limit: args.limit,
      priorities: args.priorities,
      queues: args.queues,
      state: args.state,
    },
  ];
};

export const listJobs: QueryFunction<JobMinimal[], ListJobsKey> = async ({
  queryKey,
  signal,
}) => {
  const [, { ids, kinds, limit, priorities, queues, state }] = queryKey;

  // Build query params object with only defined values
  const params: Record<string, string | string[]> = {
    limit: String(limit),
  };
  if (ids?.length) params.ids = ids.map(String);
  if (kinds?.length) params.kinds = kinds;
  if (priorities?.length) params.priorities = priorities.map(String);
  if (queues?.length) params.queues = queues;
  if (state) params.state = state;

  // Convert to URLSearchParams, handling arrays correctly
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else {
      query.append(key, value);
    }
  });

  return API.get<ListResponse<JobMinimalFromAPI>>(
    { path: "/jobs", query },
    { signal },
  ).then(
    // Map from JobFromAPI to Job:
    // TODO: there must be a cleaner way to do this given the type definitions?
    (response) => response.data.map(apiJobMinimalToJobMinimal),
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
