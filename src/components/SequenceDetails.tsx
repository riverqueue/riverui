import type { JobSequence, SequenceJob } from "@services/sequences";

import { Badge } from "@components/Badge";
import CopyableHeadingText from "@components/CopyableHeadingText";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import { JobState } from "@services/types";
import { Link } from "@tanstack/react-router";

type SequenceDetailsProps = {
  error?: boolean;
  sequence?: JobSequence;
  sequenceKey: string;
};

const reasonLabels: Record<JobSequence["waitReason"], string> = {
  awaiting_promotion: "Waiting for sequence scheduling",
  halted: "Sequence halted by a failed job",
  none: "This job is not pending",
  waiting: "Waiting for jobs in this sequence",
};

export default function SequenceDetails({
  error,
  sequence,
  sequenceKey,
}: SequenceDetailsProps) {
  const head = sequence?.blockers[0] ?? sequence?.firstPending;
  const otherBlockers = sequence?.blockers.filter((job) => job.id !== head?.id);

  return (
    <section
      aria-label="Sequence"
      className="border-t border-slate-100 p-4 text-sm text-slate-700 sm:px-0 dark:border-slate-800 dark:text-slate-300"
    >
      <h2 className="mb-3 font-medium text-slate-900 dark:text-slate-100">
        Sequence
      </h2>
      <div className="mb-4 font-mono break-all text-slate-600 dark:text-slate-400">
        <CopyableHeadingText label="sequence key" text={sequenceKey} />
      </div>
      {error ? (
        <p role="status">Sequence details could not be loaded.</p>
      ) : !sequence ? (
        <p role="status">Loading sequence details…</p>
      ) : (
        <dl className="space-y-4">
          <div>
            <dt className="font-medium">Wait reason</dt>
            <dd className="mt-1">{reasonLabels[sequence.waitReason]}</dd>
          </div>
          {head ? (
            <div>
              <dt className="font-medium">Sequence head</dt>
              <dd className="mt-1">
                <SequenceJobSummary currentJobId={sequence.jobId} job={head} />
              </dd>
            </div>
          ) : (
            <div>
              <dt className="font-medium">Sequence head</dt>
              <dd className="mt-1">No pending or active jobs</dd>
            </div>
          )}
          {sequence.firstPending && sequence.firstPending.id !== head?.id && (
            <div>
              <dt className="font-medium">Next pending job</dt>
              <dd className="mt-1">
                <SequenceJobSummary
                  currentJobId={sequence.jobId}
                  job={sequence.firstPending}
                />
              </dd>
            </div>
          )}
          {otherBlockers && otherBlockers.length > 0 && (
            <div>
              <dt className="font-medium">Other blocking jobs</dt>
              <dd className="mt-1 space-y-2">
                {otherBlockers.map((job) => (
                  <SequenceJobSummary
                    currentJobId={sequence.jobId}
                    job={job}
                    key={job.id.toString()}
                  />
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

function SequenceJobSummary({
  currentJobId,
  job,
}: {
  currentJobId: bigint;
  job: SequenceJob;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="font-mono text-blue-600 hover:underline dark:text-blue-400"
          params={{ jobId: job.id }}
          to="/jobs/$jobId"
        >
          #{job.id.toString()}
        </Link>
        <Badge>{job.state}</Badge>
        {job.id === currentJobId && <span>(this job)</span>}
      </div>
      <p className="mt-1 break-all text-slate-600 dark:text-slate-400">
        {job.kind} · {job.queue}
      </p>
      {(job.state === JobState.Retryable ||
        job.state === JobState.Scheduled) && (
        <p className="mt-1">
          Scheduled <RelativeTimeFormatter addSuffix time={job.scheduledAt} />
        </p>
      )}
    </div>
  );
}
