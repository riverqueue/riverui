import { RunningSpinnerIcon } from "@components/icons/jobStateIcons";
import {
  CheckCircleIcon,
  ClockIcon,
  EllipsisHorizontalCircleIcon,
  ExclamationTriangleIcon,
  PlayCircleIcon,
  QuestionMarkCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { JobState } from "@services/types";
import { capitalize } from "@utils/string";
import clsx from "clsx";

export const TaskStateIcon = ({
  className,
  jobState,
}: {
  className?: string;
  jobState: JobState;
}) => {
  const sharedProps = { title: capitalize(jobState || "Missing") };

  switch (jobState) {
    case JobState.Available:
      return (
        <PlayCircleIcon
          className={clsx(className, "text-blue-500")}
          {...sharedProps}
        />
      );
    case JobState.Cancelled:
      return (
        <XCircleIcon
          className={clsx(className, "text-red-500")}
          {...sharedProps}
        />
      );
    case JobState.Completed:
      return (
        <CheckCircleIcon
          className={clsx(className, "text-green-500")}
          {...sharedProps}
        />
      );
    case JobState.Discarded:
      return (
        <XCircleIcon
          className={clsx(className, "text-red-500")}
          {...sharedProps}
        />
      );
    case JobState.Pending:
      return (
        <EllipsisHorizontalCircleIcon
          className={clsx(className, "text-slate-500 dark:text-slate-400")}
          {...sharedProps}
        />
      );
    case JobState.Retryable:
      return (
        <ExclamationTriangleIcon
          className={clsx(className, "text-amber-500")}
          {...sharedProps}
        />
      );
    case JobState.Running:
      return (
        <RunningSpinnerIcon
          className={clsx(className, "text-blue-500")}
          {...sharedProps}
        />
      );
    case JobState.Scheduled:
      return (
        <ClockIcon
          className={clsx(className, "text-slate-500 dark:text-slate-400")}
          {...sharedProps}
        />
      );
    default:
      return (
        <QuestionMarkCircleIcon
          className={clsx(className, "text-slate-500 dark:text-slate-400")}
          {...sharedProps}
        />
      );
  }
};
