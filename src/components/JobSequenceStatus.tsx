import { Badge, type BadgeColor } from "@components/Badge";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import { ArrowRightIcon } from "@heroicons/react/16/solid";
import {
  type JobSequence,
  type JobSequenceStatus,
  type SequenceJob,
} from "@services/sequences";
import { JobState } from "@services/types";
import { Link } from "@tanstack/react-router";
import { capitalize } from "@utils/string";
import clsx from "clsx";
import { type ReactNode } from "react";
import { useTime } from "react-time-sync";

type JobRef = { id: bigint; state: JobState };

type JobTiming = { scheduledAt: Date; state: JobState };

// SequenceJobLink links to a job in a sequence by ID, with its kind, queue,
// and state on hover.
export function SequenceJobLink({
  job,
}: {
  job: { id: bigint } & Partial<Pick<SequenceJob, "kind" | "queue" | "state">>;
}) {
  return (
    <Link
      className="font-mono font-medium text-blue-600 hover:underline dark:text-blue-400"
      params={{ jobId: job.id }}
      title={
        job.kind ? [job.kind, job.queue, job.state].join(" · ") : undefined
      }
      to="/jobs/$jobId"
    >
      #{job.id.toString()}
    </Link>
  );
}

// SequenceJobStatePhrase says what happened to a job holding its sequence
// back, with when it runs next if that's known: "Cancelled", "Retrying in 4
// minutes". A retry or schedule that's already due says so.
export function SequenceJobStatePhrase({ job }: { job: JobTiming }) {
  const nowSec = useTime();
  const due = job.scheduledAt.getTime() <= nowSec * 1000;
  const time = <RelativeTimeFormatter addSuffix time={job.scheduledAt} />;
  switch (job.state) {
    case JobState.Retryable:
      return due ? <>Retry due {time}</> : <>Retrying {time}</>;
    case JobState.Scheduled:
      return due ? <>Due {time}</> : <>Runs {time}</>;
    default:
      return <>{capitalize(job.state)}</>;
  }
}

// Text colors match the state icons used across the UI. A retrying job is
// amber because it errored, and finalized failures are red.
const stateTextColors: Record<JobState, string> = {
  [JobState.Available]: "text-blue-700 dark:text-blue-400",
  [JobState.Cancelled]: "text-red-700 dark:text-red-400",
  [JobState.Completed]: "text-green-700 dark:text-green-400",
  [JobState.Discarded]: "text-red-700 dark:text-red-400",
  [JobState.Pending]: "text-slate-600 dark:text-slate-400",
  [JobState.Retryable]: "text-amber-700 dark:text-amber-400",
  [JobState.Running]: "text-blue-700 dark:text-blue-400",
  [JobState.Scheduled]: "text-slate-600 dark:text-slate-400",
};

// SequenceJobRefState links to a job and follows it with its state as plain
// text, like "by #7001 · Cancelled", so the status badge and the link stay
// the line's only accents. The dot stays with the link, so a narrow field
// breaks before the state rather than before the dot.
export function SequenceJobRefState({
  job,
  prefix,
}: {
  job: SequenceJob;
  prefix?: string;
}) {
  return (
    <>
      <Phrase>
        {prefix && `${prefix} `}
        <SequenceJobLink job={job} />
        <span className={muted}> ·</span>
      </Phrase>{" "}
      <Phrase>
        <SequenceJobStatePhrase job={job} />
      </Phrase>
    </>
  );
}

// SequenceJobState is a job's state as a phrase in the state's color, for
// where the phrase stands on its own, like a sequence page row whose state
// icon is already beside it.
export function SequenceJobState({ job }: { job: JobTiming }) {
  return (
    <span className={clsx("whitespace-nowrap", stateTextColors[job.state])}>
      <SequenceJobStatePhrase job={job} />
    </span>
  );
}

const muted = "text-slate-500 dark:text-slate-400";

type StatusSummary = {
  color: BadgeColor;
  detail: ReactNode;
  // A short follow-up line, like what to do about a halted sequence.
  hint?: ReactNode;
  label: string;
};

// SequenceStatusField is a details grid cell carrying a job's place in its
// sequence at a glance, with a link to the sequence's own page.
export function SequenceStatusField({
  className,
  job,
  status,
}: {
  className?: string;
  job: JobRef;
  status: JobSequenceStatus;
}) {
  const { jobSequence } = status;
  const summary =
    !status.error && jobSequence
      ? sequenceStatusSummary(job, jobSequence)
      : null;
  const head = jobSequence?.sequence.head;

  let content: ReactNode;
  if (status.error) {
    content = <span className={muted}>Status unavailable</span>;
  } else if (!jobSequence) {
    content = <span className={muted}>Loading…</span>;
  } else if (summary) {
    content = (
      <>
        <span className="flex flex-wrap items-center gap-x-1.5">
          <Badge color={summary.color}>{summary.label}</Badge>
          <span>{summary.detail}</span>
        </span>
        {summary.hint && (
          <span className={`mt-1 block text-xs leading-5 ${muted}`}>
            {summary.hint}
          </span>
        )}
      </>
    );
  } else if (head && head.id !== job.id) {
    content = (
      <>
        Next pending: <SequenceJobLink job={head} />
      </>
    );
  } else {
    content = <span className={muted}>No pending jobs</span>;
  }

  return (
    <div className={className}>
      <dt className="flex items-baseline justify-between gap-2 text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
        Sequence
        <Link
          aria-label="View sequence"
          className="inline-flex items-center gap-0.5 text-xs font-medium whitespace-nowrap text-blue-600 hover:underline dark:text-blue-400"
          params={{ sequenceKey: status.key }}
          search={{ job: job.id }}
          to="/sequences/$sequenceKey"
        >
          View
          <ArrowRightIcon aria-hidden="true" className="size-3" />
        </Link>
      </dt>
      <dd
        aria-live="polite"
        className="mt-1 text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300"
      >
        {content}
      </dd>
    </div>
  );
}

// Phrase keeps a short run of words, like "by #48213171", on one line, so a
// narrow field wraps between phrases rather than inside one.
function Phrase({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx("whitespace-nowrap", className)}>{children}</span>
  );
}

// sequenceStatusSummary is the badge and explanation for a job in a sequence.
// Pending jobs say why they're waiting, and a job that halts its sequence says
// so. Other jobs get no summary and show the sequence's next pending job
// instead.
function sequenceStatusSummary(
  job: JobRef,
  jobSequence: JobSequence,
): null | StatusSummary {
  const { sequence, waitingOn } = jobSequence;

  if (job.state === JobState.Pending) {
    switch (jobSequence.waitReason) {
      case "halted":
        if (!waitingOn) break;
        return {
          color: "red",
          detail: <SequenceJobRefState job={waitingOn} prefix="by" />,
          hint: "Retry or delete it to resume.",
          label: "Halted",
        };
      case "none":
        break;
      case "up_next":
        return {
          color: "zinc",
          detail: <span className={muted}>nothing blocking</span>,
          label: "Up next",
        };
      case "waiting_behind_pending":
        if (!waitingOn) break;
        return {
          color: "amber",
          detail: <SequenceJobRefState job={waitingOn} prefix="behind" />,
          label: "Waiting",
        };
      case "waiting_on_active":
        if (!waitingOn) break;
        return {
          color: "amber",
          detail: <SequenceJobRefState job={waitingOn} prefix="on" />,
          label: "Waiting",
        };
    }
    return null;
  }

  if (jobSequence.halting && sequence.head) {
    const earlierHalt =
      sequence.haltedBy && sequence.haltedBy.id !== job.id
        ? sequence.haltedBy
        : null;
    return {
      color: "red",
      detail: (
        <>
          <SequenceJobLink job={sequence.head} />{" "}
          <span className={muted}>and later jobs wait</span>
        </>
      ),
      hint: earlierHalt ? (
        <>
          Earlier job <SequenceJobLink job={earlierHalt} /> also halts it.
        </>
      ) : (
        "Retry or delete this job to resume."
      ),
      label: "Halted",
    };
  }

  return null;
}
