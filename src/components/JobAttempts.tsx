import {
  ArrowPathRoundedSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  ComputerDesktopIcon,
  ExclamationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { Job } from "@services/jobs";
import { JobState } from "@services/types";
import clsx from "clsx";
import { useMemo, useState } from "react";

import { DurationCompact } from "./DurationCompact";
import RelativeTimeFormatter from "./RelativeTimeFormatter";

type AttemptEntry =
  | AttemptErrorEntry
  | AttemptLogEntry
  | AttemptMachineEntry
  | AttemptStateEntry;

type AttemptEntryBase = {
  attempt: number;
  timestamp: Date;
};

type AttemptErrorEntry = {
  error: string;
  trace?: string;
  type: "error";
} & AttemptEntryBase;

// Consolidated information for a single attempt
type AttemptInfo = {
  attemptNumber: number;
  duration?: {
    endTime?: Date;
    startTime?: Date;
  };
  errors: AttemptErrorEntry[];
  logs: AttemptLogEntry[];
  machine?: string;
  state?: JobState;
  timestamp: Date;
};

type AttemptLogEntry = {
  log: string;
  type: "log";
} & AttemptEntryBase;

type AttemptMachineEntry = {
  machine: string;
  type: "machine";
} & AttemptEntryBase;

type AttemptStateEntry = {
  duration?: {
    endTime?: Date;
    startTime: Date;
  };
  state: JobState;
  type: "state";
} & AttemptEntryBase;

type JobAttemptProps = {
  job: Job;
};

export default function JobAttempts({ job }: JobAttemptProps) {
  const [showAllAttempts, setShowAllAttempts] = useState(false);

  // Group all entries by attempt number
  const attemptInfos = useMemo(() => {
    // Create all entries first
    const errorEntries = job.errors.map(
      (error): AttemptErrorEntry => ({
        attempt: error.attempt,
        error: error.error,
        timestamp: error.at,
        trace: error.trace,
        type: "error",
      }),
    );

    const logEntries = Object.entries(job.logs).map(
      ([attemptStr, log]): AttemptLogEntry => ({
        attempt: parseInt(attemptStr, 10),
        log,
        timestamp: job.attemptedAt || job.createdAt,
        type: "log",
      }),
    );

    const machineEntries = job.attemptedBy.map(
      (machine, index): AttemptMachineEntry => ({
        attempt: index + 1,
        machine,
        timestamp: job.attemptedAt || job.createdAt,
        type: "machine",
      }),
    );

    const stateEntries: AttemptStateEntry[] = [
      ...(job.attemptedAt && job.attempt > 0
        ? [
            {
              attempt: job.attempt,
              duration: {
                endTime: job.finalizedAt,
                startTime: job.attemptedAt,
              },
              state: JobState.Running,
              timestamp: job.attemptedAt,
              type: "state" as const,
            },
          ]
        : []),
      ...(job.finalizedAt && job.attempt > 0
        ? [
            {
              attempt: job.attempt,
              duration: job.attemptedAt
                ? {
                    endTime: job.finalizedAt,
                    startTime: job.attemptedAt,
                  }
                : undefined,
              state: job.state,
              timestamp: job.finalizedAt,
              type: "state" as const,
            },
          ]
        : []),
    ];

    // Combine all entries and group by attempt number
    const entriesByAttempt = [
      ...errorEntries,
      ...logEntries,
      ...machineEntries,
      ...stateEntries,
    ].reduce((acc, entry) => {
      const entries = acc.get(entry.attempt) || [];
      return acc.set(entry.attempt, [...entries, entry]);
    }, new Map<number, AttemptEntry[]>());

    // Convert map to array of AttemptInfo objects
    return Array.from(entriesByAttempt.entries())
      .map(([attemptNumber, entries]) => {
        // Get latest timestamp for the attempt
        const timestamp = entries.reduce(
          (latest, entry) =>
            latest > entry.timestamp ? latest : entry.timestamp,
          new Date(0),
        );

        // Extract errors, logs, machine info
        const errors = entries.filter(
          (e): e is AttemptErrorEntry => e.type === "error",
        );
        const logs = entries.filter(
          (e): e is AttemptLogEntry => e.type === "log",
        );
        const machineEntry = entries.find(
          (e): e is AttemptMachineEntry => e.type === "machine",
        );

        // Find state/duration info
        const stateEntries = entries.filter(
          (e): e is AttemptStateEntry => e.type === "state",
        );
        const runningEntry = stateEntries.find(
          (e) => e.state === JobState.Running,
        );
        const finalizedEntry = stateEntries.find(
          (e) => e.state !== JobState.Running,
        );

        const state = finalizedEntry?.state;

        // Determine duration if possible
        const duration = runningEntry?.duration
          ? {
              endTime:
                finalizedEntry?.duration?.endTime || finalizedEntry?.timestamp,
              startTime: runningEntry.duration.startTime,
            }
          : undefined;

        return {
          attemptNumber,
          duration,
          errors,
          logs,
          machine: machineEntry?.machine,
          state,
          timestamp,
        };
      })
      .sort((a, b) => b.attemptNumber - a.attemptNumber);
  }, [job]);

  const attemptsToDisplay = useMemo(() => {
    if (showAllAttempts) {
      return attemptInfos;
    }
    return attemptInfos.slice(0, 5);
  }, [attemptInfos, showAllAttempts]);

  return (
    <div className="col-span-1 border-t border-slate-100 px-4 py-6 sm:col-span-2 sm:px-0 dark:border-slate-800">
      <div className="lg:px-0">
        <dt className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Attempts
        </dt>
        <dd className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">
          {attemptInfos.length === 0 ? (
            <div className="py-4 text-slate-500 dark:text-slate-400">
              No attempt information available
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {attemptsToDisplay.map((info) => (
                  <AttemptRow attemptInfo={info} key={info.attemptNumber} />
                ))}
              </ul>
              {!showAllAttempts && attemptInfos.length > 5 && (
                <button
                  className="mt-4 text-sm font-semibold text-indigo-600 hover:underline dark:text-slate-100"
                  onClick={() => setShowAllAttempts(true)}
                  type="button"
                >
                  Show all {attemptInfos.length} attempts
                </button>
              )}
              {showAllAttempts && (
                <button
                  className="mt-4 text-sm font-semibold text-indigo-600 hover:underline dark:text-slate-100"
                  onClick={() => setShowAllAttempts(false)}
                  type="button"
                >
                  Show fewer attempts
                </button>
              )}
            </>
          )}
        </dd>
      </div>
    </div>
  );
}

function AttemptRow({ attemptInfo }: { attemptInfo: AttemptInfo }) {
  // Determine status/outcome icon
  const getIcon = () => {
    if (attemptInfo.errors.length > 0) {
      return <ExclamationCircleIcon className="h-5 w-5 text-rose-500" />;
    }
    if (attemptInfo.state === JobState.Completed) {
      return <CheckCircleIcon className="h-5 w-5 text-emerald-500" />;
    } else if (attemptInfo.state === JobState.Cancelled) {
      return <XCircleIcon className="h-5 w-5 text-amber-500" />;
    } else if (attemptInfo.state === JobState.Running) {
      return <ArrowPathRoundedSquareIcon className="h-5 w-5 text-indigo-500" />;
    } else if (
      attemptInfo.state === JobState.Discarded ||
      attemptInfo.state === JobState.Retryable
    ) {
      return <ExclamationCircleIcon className="h-5 w-5 text-rose-500" />;
    }
    return <ClockIcon className="h-5 w-5 text-slate-400" />;
  };

  const getStatus = () => {
    if (attemptInfo.errors.length > 0) {
      return "Failed";
    }
    if (attemptInfo.state === JobState.Completed) {
      return "Completed";
    } else if (attemptInfo.state === JobState.Cancelled) {
      return "Cancelled";
    } else if (attemptInfo.state === JobState.Running) {
      return "Running";
    } else if (attemptInfo.state === JobState.Discarded) {
      return "Discarded";
    } else if (attemptInfo.state === JobState.Retryable) {
      return "Will Retry";
    }
    return "Unknown";
  };

  const isMultilineError = (error: string) => error.includes("\n");

  return (
    <li className="py-4">
      <div className="flex items-start">
        <div className="mt-0.5 mr-4 shrink-0">{getIcon()}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <h4 className="font-medium text-slate-900 dark:text-slate-100">
              <span>{getStatus()}</span>
              <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                (Attempt {attemptInfo.attemptNumber})
              </span>
            </h4>
            <div className="flex items-center gap-x-2">
              {attemptInfo.duration && (
                <span className="text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                  <DurationCompact
                    endTime={attemptInfo.duration.endTime}
                    startTime={attemptInfo.duration.startTime}
                  />
                </span>
              )}
              <time className="text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                <RelativeTimeFormatter addSuffix time={attemptInfo.timestamp} />
              </time>
            </div>
          </div>
          {attemptInfo.machine && (
            <div className="mt-1 flex items-center gap-x-2">
              <ComputerDesktopIcon className="h-4 w-4 text-slate-400" />
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {attemptInfo.machine}
              </span>
            </div>
          )}
          {attemptInfo.errors.length > 0 && (
            <div className="mt-3 space-y-3">
              {attemptInfo.errors.map((error, idx) => (
                <div className="space-y-3" key={idx}>
                  <div
                    className={clsx(
                      "font-mono text-sm text-slate-900 dark:text-slate-100",
                      isMultilineError(error.error) &&
                        "block h-min max-h-80 resize-y overflow-auto rounded-md bg-slate-300/20 px-4 py-2 whitespace-pre dark:bg-slate-700/20",
                    )}
                  >
                    {error.error}
                  </div>
                  {error.trace && (
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-slate-600 select-none dark:text-slate-400">
                        Stack Trace
                      </summary>
                      <pre className="mt-2 max-h-[500px] w-full resize-y overflow-x-auto rounded-md bg-slate-300/20 px-4 py-2 font-mono text-sm whitespace-pre text-slate-900 dark:bg-slate-700/20 dark:text-slate-100">
                        {error.trace}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
          {attemptInfo.logs.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600 select-none dark:text-slate-400">
                Logs
              </summary>
              <div className="mt-2 space-y-2">
                {attemptInfo.logs.map((log, idx) => (
                  <div
                    className="max-h-[300px] w-full resize-y overflow-x-auto rounded-md bg-slate-300/20 px-4 py-2 font-mono text-sm whitespace-pre text-slate-900 dark:bg-slate-700/20 dark:text-slate-100"
                    key={idx}
                  >
                    {log.log}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}
