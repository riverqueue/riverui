import { DurationCompact } from "@components/DurationCompact";
import {
  ArrowPathRoundedSquareIcon,
  CheckCircleIcon,
  CircleStackIcon,
  ClockIcon,
  ExclamationCircleIcon,
  QueueListIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { AttemptError, Job } from "@services/jobs";
import { Heroicon, JobState } from "@services/types";
import clsx from "clsx";
import { formatDistanceStrict } from "date-fns";
import { useMemo } from "react";
import { useTime } from "react-time-sync";

const useRelativeFormattedTime = (time: Date, addSuffix: boolean): string => {
  const nowSec = useTime();
  const now = useMemo(() => new Date(nowSec * 1000), [nowSec]);
  const relative = useMemo(
    () => formatDistanceStrict(time, now, { addSuffix }),
    [addSuffix, now, time],
  );
  return relative;
};

type StepStatus = "active" | "complete" | "failed" | "pending";

function RelativeTime({
  addSuffix = false,
  time,
}: {
  addSuffix?: boolean;
  time: Date;
}) {
  return useRelativeFormattedTime(time, addSuffix);
}

const StatusStep = ({
  children,
  description,
  descriptionTitle,
  Icon,
  name,
  status,
}: {
  children?: React.ReactNode;
  description?: string;
  descriptionTitle?: string;
  Icon: Heroicon;
  name: string;
  status: StepStatus;
}) => {
  const statusVerticalLineClasses = statusVerticalLineClassesFor(status);
  const statusIconClasses = statusIconClassesFor(status);

  return (
    <li
      className={clsx(
        "relative ms-6 pb-2 before:absolute before:top-0 before:-left-1 before:block before:h-full before:w-0.5 before:border-l before:content-['']",
        statusVerticalLineClasses,
        "last:before:border-transparent dark:last:before:border-transparent",
      )}
    >
      <span
        className={clsx(
          "absolute -start-5 flex size-8 items-center justify-center rounded-full ring-4 ring-white dark:ring-gray-900",
          statusIconClasses,
        )}
      >
        <Icon
          aria-hidden="true"
          className={clsx("size-5 text-slate-900 dark:text-white")}
        />
      </span>
      <h3 className="ml-6 pt-1.5 leading-tight font-medium">{name}</h3>
      <p className="ml-6 text-sm" title={descriptionTitle}>
        {children || description}
      </p>
    </li>
  );
};

const statusVerticalLineClassesFor = (status: StepStatus): string => {
  switch (status) {
    case "active":
      return "before:border-gray-200 dark:before:border-gray-700";
    case "complete":
      return "before:border-green-400 dark:before:border-green-900";
    case "failed":
      return "before:border-red-200 dark:before:border-red-900";
    case "pending":
      return "before:border-gray-200 dark:before:border-gray-700";
  }
  return "";
};

const statusIconClassesFor = (status: StepStatus): string => {
  switch (status) {
    case "active":
      return "bg-yellow-200 dark:bg-yellow-600";
    case "complete":
      return "bg-green-300 dark:bg-green-700";
    case "failed":
      return "bg-red-200 dark:bg-red-700";
    case "pending":
      return "bg-gray-100 dark:bg-gray-700";
  }
  return "";
};

const ScheduledStep = ({ job }: { job: Job }) => {
  if (job.state === JobState.Scheduled && job.scheduledAt > new Date()) {
    return (
      <StatusStep
        descriptionTitle={job.scheduledAt.toUTCString()}
        Icon={ClockIcon}
        name="Scheduled"
        status="active"
      >
        <RelativeTime time={job.scheduledAt} />
      </StatusStep>
    );
  }

  return (
    <StatusStep
      descriptionTitle={job.scheduledAt.toUTCString()}
      Icon={ClockIcon}
      name="Scheduled"
      status="complete"
    >
      <RelativeTime addSuffix={true} time={job.scheduledAt} />
    </StatusStep>
  );
};

const WaitStep = ({ job }: { job: Job }) => {
  const nowSec = useTime();
  const scheduledAtInFuture = useMemo(
    () => job.scheduledAt >= new Date(nowSec * 1000),
    [job.scheduledAt, nowSec],
  );

  if (job.state === JobState.Scheduled && !job.attemptedAt) {
    return (
      <StatusStep
        description="—"
        Icon={QueueListIcon}
        name="Wait"
        status="pending"
      />
    );
  }

  if (job.state === JobState.Pending) {
    return (
      <StatusStep
        description="Pending"
        Icon={QueueListIcon}
        name="Wait"
        status="pending"
      />
    );
  }

  if (job.state === JobState.Retryable && scheduledAtInFuture) {
    return (
      <StatusStep
        descriptionTitle={job.scheduledAt.toUTCString()}
        Icon={QueueListIcon}
        name="Wait"
        status="complete"
      >
        —
      </StatusStep>
    );
  }

  if (job.state === JobState.Available) {
    return (
      <StatusStep Icon={QueueListIcon} name="Wait" status="active">
        (<DurationCompact startTime={job.scheduledAt} />)
      </StatusStep>
    );
  }

  return (
    <StatusStep Icon={QueueListIcon} name="Wait" status="complete">
      (<DurationCompact startTime={job.attemptedAt} />)
    </StatusStep>
  );
};

const RunningStep = ({ job }: { job: Job }) => {
  if (
    !job.attemptedAt ||
    job.state === JobState.Available ||
    job.state === JobState.Scheduled ||
    job.state === JobState.Pending
  ) {
    return (
      <StatusStep
        description="Not yet started"
        Icon={ArrowPathRoundedSquareIcon}
        name="Running"
        status="pending"
      />
    );
  }

  if (job.state === JobState.Running) {
    return (
      <StatusStep
        descriptionTitle={job.attemptedAt.toUTCString()}
        Icon={ArrowPathRoundedSquareIcon}
        name="Running"
        status="active"
      >
        <DurationCompact startTime={job.attemptedAt} />
      </StatusStep>
    );
  }

  if (job.state === JobState.Cancelled) {
    // Jobs can be cancelled while they aren't running, but there's no easy way
    // to detect this situation from the job data. Although this leaves some
    // confusing edge cases, the best we can do today is to just assume any
    // cancelled jobs which have been attempted were cancelled at the end of
    // their run, and thus their run duration is (finalized_at - attempted_at).
    const cancelledWhileRunning = Boolean(job.attemptedAt);
    const state = cancelledWhileRunning ? "complete" : "pending";
    return (
      <StatusStep
        Icon={ArrowPathRoundedSquareIcon}
        name="Running"
        status={state}
      >
        <RelativeTime addSuffix={true} time={job.attemptedAt} /> (
        <DurationCompact
          endTime={job.finalizedAt!}
          startTime={job.attemptedAt}
        />
        )
      </StatusStep>
    );
  }

  const lastError: AttemptError | undefined = job.errors.at(-1);
  const jobEndTime: Date | undefined = job.finalizedAt || lastError?.at;

  const errored =
    job.state === JobState.Discarded || job.state === JobState.Retryable;

  return (
    <StatusStep
      descriptionTitle={
        errored ? lastError?.at.toUTCString() : job.attemptedAt.toUTCString()
      }
      Icon={errored ? ExclamationCircleIcon : CheckCircleIcon}
      name={errored ? "Errored" : "Running"}
      status={errored ? "failed" : "complete"}
    >
      <RelativeTime addSuffix={true} time={job.attemptedAt} />
      {jobEndTime && (
        <>
          {" "}
          (
          <DurationCompact endTime={jobEndTime} startTime={job.attemptedAt} />)
        </>
      )}
    </StatusStep>
  );
};

const RetryableStep = ({ job }: { job: Job }) => {
  if (job.state === JobState.Retryable) {
    return (
      <StatusStep
        descriptionTitle={job.scheduledAt.toUTCString()}
        Icon={ClockIcon}
        name="Awaiting Retry"
        status="active"
      >
        Job errored, retrying <RelativeTime addSuffix time={job.scheduledAt} />
      </StatusStep>
    );
  }
};

const FinalizedStep = ({ job }: { job: Job }) => {
  if (!job.finalizedAt) {
    return (
      <StatusStep
        description="—"
        Icon={CheckCircleIcon}
        name="Complete"
        status="pending"
      />
    );
  }

  if (job.state === JobState.Completed) {
    return (
      <StatusStep
        descriptionTitle={job.finalizedAt.toUTCString()}
        Icon={CheckCircleIcon}
        name="Complete"
        status="complete"
      >
        <RelativeTime addSuffix={true} time={job.finalizedAt} />
      </StatusStep>
    );
  }
  if (job.state === JobState.Discarded) {
    return (
      <StatusStep
        descriptionTitle={job.finalizedAt.toUTCString()}
        Icon={TrashIcon}
        name="Discarded"
        status="failed"
      >
        <RelativeTime addSuffix={true} time={job.finalizedAt} />
      </StatusStep>
    );
  }
  if (job.state === JobState.Cancelled) {
    return (
      <StatusStep
        descriptionTitle={job.finalizedAt.toUTCString()}
        Icon={XCircleIcon}
        name="Cancelled"
        status="failed"
      >
        <RelativeTime addSuffix={true} time={job.finalizedAt} />
      </StatusStep>
    );
  }
};

type JobTimelineProps = {
  job: Job;
};

export default function JobTimeline({ job }: JobTimelineProps) {
  return (
    <ol className="relative px-2 text-gray-500 sm:px-0 dark:text-gray-400">
      <StatusStep
        descriptionTitle={job.createdAt.toUTCString()}
        Icon={CircleStackIcon}
        name="Created"
        status="complete"
      >
        <RelativeTime addSuffix={true} time={job.createdAt} />
      </StatusStep>
      <ScheduledStep job={job} />
      <WaitStep job={job} />
      <RunningStep job={job} />
      <RetryableStep job={job} />
      <FinalizedStep job={job} />
    </ol>
  );
}
