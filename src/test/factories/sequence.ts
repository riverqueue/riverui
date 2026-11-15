import type {
  JobSequence,
  SequenceInspection,
  SequenceJob,
  SequenceJobListItem,
} from "@services/sequences";

import { JobState } from "@services/types";

// Sequence keys are usually hashes, like this base64 SHA-256 digest.
export const sequenceKeyFixture =
  "kM2xQ7pR9tVb3nY8wZ1aC4dF6gH0jL5sE7uI2oP9qT4=";

const minutesFromNow = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000);

export const sequenceJob = (
  id: bigint,
  state: JobState,
  overrides: Partial<SequenceJob> = {},
): SequenceJob => ({
  id,
  kind: "update_order_status",
  queue: "orders",
  scheduledAt: minutesFromNow(state === JobState.Retryable ? 4 : -5),
  state,
  ...overrides,
});

export const sequenceInspection = (
  overrides: Partial<SequenceInspection> = {},
): SequenceInspection => ({
  blockers: [],
  haltedBy: null,
  head: null,
  key: sequenceKeyFixture,
  pendingCount: null,
  ...overrides,
});

export const jobSequence = (
  overrides: Partial<JobSequence> = {},
): JobSequence => ({
  halting: false,
  jobId: 7003n,
  jobState: JobState.Pending,
  sequence: sequenceInspection(),
  waitingOn: null,
  waitReason: "none",
  ...overrides,
});

export const sequenceListItem = (
  id: bigint,
  state: JobState,
  minutesAgo: number,
  status: string,
): SequenceJobListItem => {
  const at = minutesFromNow(-minutesAgo);
  const finalized = [
    JobState.Cancelled,
    JobState.Completed,
    JobState.Discarded,
  ].includes(state);
  return {
    argsRaw: JSON.stringify({ order_id: 48213, status }),
    attempt: state === JobState.Pending ? 0 : 1,
    attemptedAt: state === JobState.Pending ? undefined : at,
    createdAt: minutesFromNow(-minutesAgo - 1),
    finalizedAt: finalized ? at : undefined,
    id,
    kind: id === 6990n ? "process_order" : "update_order_status",
    maxAttempts: 25,
    priority: 1,
    queue: "orders",
    scheduledAt: state === JobState.Retryable ? minutesFromNow(4) : at,
    state,
  };
};

// A sequence halted by a cancelled job, with completed jobs before it and
// pending jobs waiting behind it.
export const haltedSequenceFixture = {
  inspection: sequenceInspection({
    blockers: [sequenceJob(7001n, JobState.Cancelled)],
    haltedBy: sequenceJob(7001n, JobState.Cancelled),
    head: sequenceJob(7003n, JobState.Pending),
    pendingCount: { count: 2341, more: false },
  }),
  jobs: [
    sequenceListItem(7001n, JobState.Cancelled, 420, "packed"),
    sequenceListItem(7003n, JobState.Pending, 300, "shipped"),
    sequenceListItem(7010n, JobState.Pending, 120, "delivered"),
    sequenceListItem(7022n, JobState.Pending, 30, "archived"),
  ],
};
