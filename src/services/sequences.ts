import type { QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import { JobState } from "./types";

// JobSequence explains where one job stands in its sequence.
export type JobSequence = {
  // True when the job is cancelled or discarded without letting its sequence
  // continue, and pending jobs wait behind it.
  halting: boolean;
  jobId: bigint;
  jobState: JobState;
  sequence: SequenceInspection;
  // The job that explains `waitReason`: the halting job, the active job, or
  // the earlier pending job. Null for `none` and `up_next`.
  waitingOn: null | SequenceJob;
  waitReason: SequenceWaitReason;
};

// JobSequenceStatus is what the job detail page knows about the sequence a job
// belongs to. The key comes from job metadata and is always available, while
// the sequence snapshot is loaded separately and may be missing or failed.
export type JobSequenceStatus = {
  error: boolean;
  jobSequence?: JobSequence;
  key: string;
};

export type SequenceInspection = {
  // The earliest blocking job in each state, in ID order.
  blockers: SequenceJob[];
  // The earliest cancelled or discarded job stopping the sequence.
  haltedBy: null | SequenceJob;
  // The sequence's earliest pending job.
  head: null | SequenceJob;
  key: string;
  // Pending jobs in the sequence, capped by the server. Null when the server
  // didn't count them.
  pendingCount: null | SequencePendingCount;
};

export type SequenceJob = {
  id: bigint;
  kind: string;
  queue: string;
  scheduledAt: Date;
  state: JobState;
};

export type SequenceJobListItem = {
  argsRaw: string;
  attempt: number;
  attemptedAt?: Date;
  createdAt: Date;
  finalizedAt?: Date;
  id: bigint;
  kind: string;
  maxAttempts: number;
  priority: number;
  queue: string;
  scheduledAt: Date;
  state: JobState;
};

export type SequenceJobListPage = {
  hasEarlier: boolean;
  hasLater: boolean;
  jobs: SequenceJobListItem[];
};

export type SequencePendingCount = {
  count: number;
  // True when the sequence has more than `count` pending jobs.
  more: boolean;
};

export type SequenceWaitReason =
  | "halted"
  | "none"
  | "up_next"
  | "waiting_behind_pending"
  | "waiting_on_active";

type JobSequenceFromAPI = {
  halting: boolean;
  job_id: string;
  job_state: JobState;
  sequence: SequenceInspectionFromAPI;
  wait_reason: SequenceWaitReason;
  waiting_on: null | SequenceJobFromAPI;
};

type SequenceInspectionFromAPI = {
  blockers: SequenceJobFromAPI[];
  halted_by: null | SequenceJobFromAPI;
  head: null | SequenceJobFromAPI;
  key: string;
  pending_count: null | SequencePendingCount;
};

type SequenceJobFromAPI = {
  id: string;
  kind: string;
  queue: string;
  scheduled_at: string;
  state: JobState;
};

type SequenceJobListItemFromAPI = {
  args: string;
  attempt: number;
  attempted_at: null | string;
  created_at: string;
  finalized_at: null | string;
  id: string;
  kind: string;
  max_attempts: number;
  priority: number;
  queue: string;
  scheduled_at: string;
  state: JobState;
};

type SequenceJobListPageFromAPI = {
  data: SequenceJobListItemFromAPI[];
  has_earlier: boolean;
  has_later: boolean;
};

// Cancelled and discarded jobs halt their sequence unless they were inserted
// with the matching continuation option, which the API accounts for.
export const isHaltingState = (state: JobState) =>
  state === JobState.Cancelled || state === JobState.Discarded;

// Jobs in these states block the rest of their sequence from anywhere in it,
// and change on their own, so a sequence with one is worth polling.
export const isActiveState = (state: JobState) =>
  state === JobState.Available ||
  state === JobState.Retryable ||
  state === JobState.Running ||
  state === JobState.Scheduled;

export const sequenceKeyFromMetadata = (
  metadata: object,
): string | undefined => {
  if (
    "seq_key" in metadata &&
    typeof metadata.seq_key === "string" &&
    metadata.seq_key.length > 0
  ) {
    return metadata.seq_key;
  }
  return undefined;
};

export type SequenceWaitTone = "halted" | "neutral" | "waiting";

// sequenceWaitSummary is a short label and tone for a pending job's wait
// step on the timeline, so it says more than "Pending".
export const sequenceWaitSummary = (
  job: { state: JobState },
  status?: JobSequenceStatus,
): { label: string; tone: SequenceWaitTone } | undefined => {
  if (job.state !== JobState.Pending || status?.error || !status?.jobSequence) {
    return undefined;
  }
  switch (status.jobSequence.waitReason) {
    case "halted":
      return { label: "Sequence halted", tone: "halted" };
    case "none":
      return undefined;
    case "up_next":
      return { label: "Up next in sequence", tone: "neutral" };
    case "waiting_behind_pending":
    case "waiting_on_active":
      return { label: "Waiting on sequence", tone: "waiting" };
  }
};

// formatPendingCount renders a capped count, like "1,000+".
export const formatPendingCount = (count: SequencePendingCount): string =>
  `${count.count.toLocaleString()}${count.more ? "+" : ""}`;

const sequenceJobFromAPI = (job: SequenceJobFromAPI): SequenceJob => ({
  id: BigInt(job.id),
  kind: job.kind,
  queue: job.queue,
  scheduledAt: new Date(job.scheduled_at),
  state: job.state,
});

const nullableSequenceJobFromAPI = (
  job: null | SequenceJobFromAPI,
): null | SequenceJob => (job ? sequenceJobFromAPI(job) : null);

export const sequenceInspectionFromAPI = (
  inspection: SequenceInspectionFromAPI,
): SequenceInspection => ({
  blockers: inspection.blockers.map(sequenceJobFromAPI),
  haltedBy: nullableSequenceJobFromAPI(inspection.halted_by),
  head: nullableSequenceJobFromAPI(inspection.head),
  key: inspection.key,
  pendingCount: inspection.pending_count,
});

export const jobSequenceFromAPI = (
  jobSequence: JobSequenceFromAPI,
): JobSequence => ({
  halting: jobSequence.halting,
  jobId: BigInt(jobSequence.job_id),
  jobState: jobSequence.job_state,
  sequence: sequenceInspectionFromAPI(jobSequence.sequence),
  waitingOn: nullableSequenceJobFromAPI(jobSequence.waiting_on),
  waitReason: jobSequence.wait_reason,
});

export const sequenceJobListItemFromAPI = (
  job: SequenceJobListItemFromAPI,
): SequenceJobListItem => ({
  argsRaw: job.args,
  attempt: job.attempt,
  attemptedAt: job.attempted_at ? new Date(job.attempted_at) : undefined,
  createdAt: new Date(job.created_at),
  finalizedAt: job.finalized_at ? new Date(job.finalized_at) : undefined,
  id: BigInt(job.id),
  kind: job.kind,
  maxAttempts: job.max_attempts,
  priority: job.priority,
  queue: job.queue,
  scheduledAt: new Date(job.scheduled_at),
  state: job.state,
});

// The job's state is part of the key so a state change (like the job being
// retried, or leaving `pending`) loads a fresh snapshot even when polling is
// off. Invalidate every state with `jobSequenceKey(jobId)`.
export const jobSequenceKey = (jobId: bigint, jobState?: JobState) =>
  jobState
    ? (["jobSequence", jobId.toString(), jobState] as const)
    : (["jobSequence", jobId.toString()] as const);

export const getJobSequence: QueryFunction<
  JobSequence,
  ReturnType<typeof jobSequenceKey>
> = async ({ queryKey: [, jobId], signal }) =>
  API.get<JobSequenceFromAPI>(
    { path: `/pro/jobs/${jobId}/sequence` },
    { signal },
  ).then(jobSequenceFromAPI);

// Matches every query for one sequence, for invalidation after an action.
export const sequenceKeyPrefix = (key: string) => ["sequence", key] as const;

export const sequenceInspectionKey = (key: string) =>
  ["sequence", key, "inspection"] as const;

export const getSequenceInspection: QueryFunction<
  SequenceInspection,
  ReturnType<typeof sequenceInspectionKey>
> = async ({ queryKey: [, key], signal }) =>
  API.get<SequenceInspectionFromAPI>(
    { path: "/pro/sequence", query: new URLSearchParams({ key }) },
    { signal },
  ).then(sequenceInspectionFromAPI);

// SequenceJobListCursor selects a page of a sequence's jobs. Without a cursor
// the page holds the newest jobs.
export type SequenceJobListCursor =
  { afterId: bigint } | { beforeId: bigint } | { newest: true };

export const sequenceJobListKey = (
  key: string,
  cursor: SequenceJobListCursor,
  limit: number,
) =>
  [
    "sequence",
    key,
    "jobs",
    "afterId" in cursor
      ? { afterId: cursor.afterId.toString() }
      : "beforeId" in cursor
        ? { beforeId: cursor.beforeId.toString() }
        : { newest: true },
    limit,
  ] as const;

export const listSequenceJobs = async (
  key: string,
  cursor: SequenceJobListCursor,
  limit: number,
  signal?: AbortSignal,
): Promise<SequenceJobListPage> => {
  const query = new URLSearchParams({ key, limit: limit.toString() });
  if ("afterId" in cursor) query.set("after_id", cursor.afterId.toString());
  if ("beforeId" in cursor) query.set("before_id", cursor.beforeId.toString());
  const page = await API.get<SequenceJobListPageFromAPI>(
    { path: "/pro/sequence/jobs", query },
    { signal },
  );
  return {
    hasEarlier: page.has_earlier,
    hasLater: page.has_later,
    jobs: page.data.map(sequenceJobListItemFromAPI),
  };
};
