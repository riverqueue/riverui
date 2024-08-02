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
import clsx from "clsx";
import { formatDistanceStrict } from "date-fns";

import { AttemptError, Job } from "@services/jobs";
import { Heroicon, JobState } from "@services/types";
import { DurationCompact } from "@components/DurationCompact";
import { useTime } from "react-time-sync";
import { useMemo } from "react";

const useRelativeFormattedTime = (time: Date, addSuffix: boolean): string => {
  const nowSec = useTime();
  const now = useMemo(() => new Date(nowSec * 1000), [nowSec]);
  const relative = useMemo(
    () => formatDistanceStrict(time, now, { addSuffix }),
    [addSuffix, now, time]
  );
  return relative;
};

function RelativeTime({
  time,
  addSuffix = false,
}: {
  time: Date;
  addSuffix?: boolean;
}) {
  return useRelativeFormattedTime(time, addSuffix);
}

type StepStatus = "pending" | "active" | "complete" | "failed";

const StatusStep = ({
  children,
  Icon,
  name,
  description,
  descriptionTitle,
  status,
}: {
  children?: React.ReactNode;
  Icon: Heroicon;
  name: string;
  description?: string;
  descriptionTitle?: string;
  status: StepStatus;
}) => {
  const statusVerticalLineClasses = statusVerticalLineClassesFor(status);
  const statusIconClasses = statusIconClassesFor(status);

  return (
    <li
      className={clsx(
        "relative ms-6 pb-4 before:absolute before:-left-1 before:top-0 before:block before:h-full before:w-0.5 before:border-l before:content-['']",
        statusVerticalLineClasses,
        "before:last:border-transparent dark:before:last:border-transparent"
      )}
    >
      <span
        className={clsx(
          "absolute -start-5 flex size-8 items-center justify-center rounded-full ring-4 ring-white dark:ring-gray-900",
          statusIconClasses
        )}
      >
        <Icon
          className={clsx("size-5 text-slate-900 dark:text-white")}
          aria-hidden="true"
        />
      </span>
      <h3 className="ml-6 pt-1.5 font-medium leading-tight">{name}</h3>
      <p className="ml-6 text-sm" title={descriptionTitle}>
        {children || description}
      </p>
    </li>
  );
};

const statusVerticalLineClassesFor = (status: StepStatus): string => {
  switch (status) {
    case "active":
      return "before:border-gray-200 before:dark:border-gray-700";
    case "pending":
      return "before:border-gray-200 before:dark:border-gray-700";
    case "complete":
      return "before:border-green-400 before:dark:border-green-900";
    case "failed":
      return "before:border-red-200 before:dark:border-red-900";
  }
  return "";
};

const statusIconClassesFor = (status: StepStatus): string => {
  switch (status) {
    case "active":
      return "bg-yellow-200 dark:bg-yellow-600";
    case "pending":
      return "bg-gray-100 dark:bg-gray-700";
    case "complete":
      return "bg-green-300 dark:bg-green-700";
    case "failed":
      return "bg-red-200 dark:bg-red-700";
  }
  return "";
};

const ScheduledStep = ({ job }: { job: Job }) => {
  if (job.state === JobState.Scheduled && job.scheduledAt > new Date()) {
    return (
      <StatusStep
        Icon={ClockIcon}
        name="Scheduled"
        status="active"
        descriptionTitle={job.scheduledAt.toUTCString()}
      >
        <RelativeTime time={job.scheduledAt} />
      </StatusStep>
    );
  }

  return (
    <StatusStep
      Icon={ClockIcon}
      name="Scheduled"
      status="complete"
      descriptionTitle={job.scheduledAt.toUTCString()}
    >
      <RelativeTime time={job.scheduledAt} addSuffix={true} />
    </StatusStep>
  );
};

const WaitStep = ({ job }: { job: Job }) => {
  const nowSec = useTime();
  const scheduledAtInFuture = useMemo(
    () => job.scheduledAt >= new Date(nowSec * 1000),
    [job.scheduledAt, nowSec]
  );

  if (job.state === JobState.Scheduled && !job.attemptedAt) {
    return (
      <StatusStep
        Icon={QueueListIcon}
        name="Wait"
        description="—"
        status="pending"
      />
    );
  }

  if (job.state === JobState.Retryable && scheduledAtInFuture) {
    return (
      <StatusStep
        Icon={QueueListIcon}
        name="Wait"
        status="complete"
        descriptionTitle={job.scheduledAt.toUTCString()}
      >
        –
      </StatusStep>
    );
  }

  const endTime =
    job.state === JobState.Available ? undefined : job.attemptedAt;

  const status = job.state === JobState.Available ? "active" : "complete";

  return (
    <StatusStep Icon={QueueListIcon} name="Wait" status={status}>
      (<DurationCompact startTime={job.scheduledAt} endTime={endTime} />)
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
        Icon={ArrowPathRoundedSquareIcon}
        name="Running"
        description="Not yet started"
        status="pending"
      />
    );
  }

  if (job.state === JobState.Running) {
    return (
      <StatusStep
        Icon={ArrowPathRoundedSquareIcon}
        name="Running"
        status="active"
        descriptionTitle={job.attemptedAt.toUTCString()}
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
        <RelativeTime time={job.attemptedAt} addSuffix={true} /> (
        <DurationCompact
          startTime={job.attemptedAt}
          endTime={job.finalizedAt!}
        />
        )
      </StatusStep>
    );
  }

  const lastError: AttemptError | undefined = job.errors.find(
    (e) => e.attempt === job.attempt
  );
  const jobEndTime: Date | undefined = job.finalizedAt || lastError?.at;

  const errored =
    job.state === JobState.Discarded || job.state === JobState.Retryable;

  return (
    <StatusStep
      Icon={errored ? ExclamationCircleIcon : CheckCircleIcon}
      name={errored ? "Errored" : "Running"}
      status={errored ? "failed" : "complete"}
      descriptionTitle={
        errored ? lastError?.at.toUTCString() : job.attemptedAt.toUTCString()
      }
    >
      <RelativeTime time={job.attemptedAt} addSuffix={true} />
      {jobEndTime && (
        <>
          {" "}
          (
          <DurationCompact startTime={job.attemptedAt} endTime={jobEndTime} />)
        </>
      )}
    </StatusStep>
  );
};

const RetryableStep = ({ job }: { job: Job }) => {
  if (job.state === JobState.Retryable) {
    return (
      <StatusStep
        Icon={ClockIcon}
        name="Awaiting Retry"
        descriptionTitle={job.scheduledAt.toUTCString()}
        status="active"
      >
        Job errored, retrying <RelativeTime time={job.scheduledAt} addSuffix />
      </StatusStep>
    );
  }
};

const FinalizedStep = ({ job }: { job: Job }) => {
  if (!job.finalizedAt) {
    return (
      <StatusStep
        Icon={CheckCircleIcon}
        name="Complete"
        description="—"
        status="pending"
      />
    );
  }

  if (job.state === JobState.Completed) {
    return (
      <StatusStep
        Icon={CheckCircleIcon}
        name="Complete"
        status="complete"
        descriptionTitle={job.finalizedAt.toUTCString()}
      >
        <RelativeTime time={job.finalizedAt} addSuffix={true} />
      </StatusStep>
    );
  }
  if (job.state === JobState.Discarded) {
    return (
      <StatusStep
        Icon={TrashIcon}
        name="Discarded"
        status="failed"
        descriptionTitle={job.finalizedAt.toUTCString()}
      >
        <RelativeTime time={job.finalizedAt} addSuffix={true} />
      </StatusStep>
    );
  }
  if (job.state === JobState.Cancelled) {
    return (
      <StatusStep
        Icon={XCircleIcon}
        name="Cancelled"
        status="failed"
        descriptionTitle={job.finalizedAt.toUTCString()}
      >
        <RelativeTime time={job.finalizedAt} addSuffix={true} />
      </StatusStep>
    );
  }
};

type JobTimelineProps = {
  job: Job;
};

export default function JobTimeline({ job }: JobTimelineProps) {
  return (
    <ol className="relative px-2 text-gray-500 dark:text-gray-400 sm:px-0">
      <StatusStep
        Icon={CircleStackIcon}
        name="Created"
        status="complete"
        descriptionTitle={job.createdAt.toUTCString()}
      >
        <RelativeTime time={job.createdAt} addSuffix={true} />
      </StatusStep>
      <ScheduledStep job={job} />
      <WaitStep job={job} />
      <RunningStep job={job} />
      <RetryableStep job={job} />
      <FinalizedStep job={job} />
    </ol>
  );
}
