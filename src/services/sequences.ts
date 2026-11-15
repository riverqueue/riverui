import type { QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import type { JobState } from "./types";

export type JobSequence = {
  blockers: SequenceJob[];
  firstPending: null | SequenceJob;
  jobId: bigint;
  key: string;
  waitReason: "awaiting_promotion" | "halted" | "none" | "waiting";
};

export type JobSequenceFromAPI = {
  blockers: SequenceJobFromAPI[];
  first_pending: null | SequenceJobFromAPI;
  job_id: string;
  key: string;
  wait_reason: JobSequence["waitReason"];
};

export type SequenceJob = {
  id: bigint;
  kind: string;
  queue: string;
  scheduledAt: Date;
  state: JobState;
};

type SequenceJobFromAPI = {
  id: string;
  scheduled_at: string;
} & Omit<SequenceJob, "id" | "scheduledAt">;

export const sequenceKeyFromMetadata = (
  metadata: object,
): string | undefined => {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "seq_key" in metadata &&
    typeof metadata.seq_key === "string" &&
    metadata.seq_key.length > 0
  ) {
    return metadata.seq_key;
  }
  return undefined;
};

const sequenceJobFromAPI = (job: SequenceJobFromAPI): SequenceJob => ({
  id: BigInt(job.id),
  kind: job.kind,
  queue: job.queue,
  scheduledAt: new Date(job.scheduled_at),
  state: job.state,
});

export const jobSequenceFromAPI = (
  sequence: JobSequenceFromAPI,
): JobSequence => ({
  blockers: sequence.blockers.map(sequenceJobFromAPI),
  firstPending: sequence.first_pending
    ? sequenceJobFromAPI(sequence.first_pending)
    : null,
  jobId: BigInt(sequence.job_id),
  key: sequence.key,
  waitReason: sequence.wait_reason,
});

export const getJobSequenceKey = (jobId: bigint) =>
  ["jobSequence", jobId.toString()] as const;

export const getJobSequence: QueryFunction<
  JobSequence,
  ReturnType<typeof getJobSequenceKey>
> = async ({ queryKey: [, jobId], signal }) =>
  API.get<JobSequenceFromAPI>(
    { path: `/pro/jobs/${jobId}/sequence` },
    { signal },
  ).then(jobSequenceFromAPI);
