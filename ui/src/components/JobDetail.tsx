import {
  ArrowUturnLeftIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import { Job } from "@services/jobs";
import { Heroicon, JobState } from "@services/types";
import { capitalize } from "@utils/string";
import clsx from "clsx";
import JobTimeline from "./JobTimeline";
import { FormEvent, useMemo, useState } from "react";
import TopNavTitleOnly from "./TopNavTitleOnly";
import RelativeTimeFormatter from "./RelativeTimeFormatter";
import JobAttemptErrors from "./JobAttemptErrors";

type JobDetailProps = {
  cancel: () => void;
  job: Job;
  retry: () => void;
};

function ButtonForGroup({
  Icon,
  disabled,
  text,
  ...props
}: {
  Icon: Heroicon;
  text: string;
} & React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      className={clsx(
        "relative inline-flex items-center px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 first:rounded-l-md last:rounded-r-md enabled:cursor-pointer enabled:hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-white dark:ring-slate-700 enabled:dark:hover:bg-slate-700 disabled:dark:text-slate-500"
      )}
      disabled={disabled}
      {...props}
    >
      <Icon className="mr-2 size-5" aria-hidden="true" />
      {text}
    </button>
  );
}

function ActionButtons({
  cancel,
  job,
  retry,
}: {
  cancel: () => void;
  job: Job;
  retry: () => void;
}) {
  // Enable immediate retry if the job is not running or pending:
  const retryDisabled = [JobState.Running, JobState.Pending].includes(
    job.state
  );
  const retryJob = (event: FormEvent) => {
    event.preventDefault();
    retry();
  };

  // Can only cancel jobs that aren't already finalized (completed, discarded, cancelled):
  const cancelDisabled = [
    JobState.Cancelled,
    JobState.Completed,
    JobState.Discarded,
  ].includes(job.state);

  const cancelJob = (event: FormEvent) => {
    event.preventDefault();
    cancel();
  };

  return (
    <span className="isolate inline-flex rounded-md shadow-sm">
      <ButtonForGroup
        Icon={ArrowUturnLeftIcon}
        text="Retry"
        disabled={retryDisabled}
        onClick={retryJob}
      />
      <ButtonForGroup
        Icon={XCircleIcon}
        text="Cancel"
        disabled={cancelDisabled}
        onClick={cancelJob}
      />
      <ButtonForGroup Icon={TrashIcon} text="Delete" />
    </span>
  );
}

export default function JobDetail({ cancel, job, retry }: JobDetailProps) {
  const [showAllAttempts, setShowAllAttempts] = useState(false);
  const attemptsToDisplay = useMemo(() => {
    if (showAllAttempts) {
      return job.attemptedBy.slice().reverse();
    }
    return job.attemptedBy.slice(-5).reverse();
  }, [job.attemptedBy, showAllAttempts]);

  return (
    <>
      <TopNavTitleOnly title="Job Details" />
      <main>
        <header>
          {/* Heading */}
          <div className="mb-8 flex flex-col items-start justify-between gap-x-8 gap-y-4 bg-gray-300/10 p-4 dark:bg-gray-700/10 sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <div>
              <h1 className="flex gap-x-3 text-2xl leading-7">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {job.kind}
                </span>
              </h1>
              <p className="mt-2 text-base leading-6 text-slate-600 dark:text-slate-400">
                ID: <span className="font-mono">{job.id.toString()}</span>
              </p>
            </div>
            <div className="order-none flex w-full justify-around sm:block sm:w-auto sm:flex-none">
              <ActionButtons cancel={cancel} job={job} retry={retry} />
            </div>
          </div>
        </header>

        <div className="mx-auto grid gap-8 pb-16 sm:grid-cols-2 sm:px-6 lg:px-8">
          {/* Description list */}
          <div className="">
            <dl className="grid grid-cols-12">
              <div className="col-span-4 border-t border-slate-100 px-4 py-6 dark:border-slate-800 sm:px-0">
                <dt className="text-sm font-medium uppercase leading-6 text-slate-900 dark:text-slate-100">
                  State
                </dt>
                <dd className="mt-1 text-sm leading-6  text-slate-700 dark:text-slate-300 sm:mt-2">
                  {capitalize(job.state)}
                </dd>
              </div>
              <div className="col-span-4 border-t border-slate-100 px-4 py-6 dark:border-slate-800 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
                  Attempt
                </dt>
                <dd className="mt-1 text-sm leading-6  text-slate-700 dark:text-slate-300 sm:mt-2">
                  {job.attempt.toString()} / {job.maxAttempts.toString()}
                </dd>
              </div>
              <div className="col-span-4 border-t border-slate-100 px-4 py-6 dark:border-slate-800 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
                  Priority
                </dt>
                <dd className="mt-1 text-sm leading-6  text-slate-700 dark:text-slate-300 sm:mt-2">
                  {job.priority.toString()}
                </dd>
              </div>
              <div className="col-span-6 border-t border-slate-100 px-4 py-6 dark:border-slate-800 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
                  Queue
                </dt>
                <dd className="mt-1 flex overflow-hidden font-mono text-sm leading-6 text-slate-700 dark:text-slate-300 sm:mt-2">
                  {job.queue}
                </dd>
              </div>
              <div className="col-span-6 border-t border-slate-100 px-4 py-6 dark:border-slate-800 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
                  Tags
                </dt>
                <dd className="mt-1 text-sm leading-6  text-slate-700 dark:text-slate-300 sm:mt-2">
                  {job.tags.length == 0
                    ? "–"
                    : job.tags.map((tag) => (
                        <div
                          key={tag}
                          className="truncate rounded-full bg-indigo-400/10 px-2 py-1 font-mono text-xs font-medium text-indigo-400 ring-1 ring-inset ring-indigo-400/30"
                        >
                          {tag}
                        </div>
                      ))}
                </dd>
              </div>
              <div className="col-span-6 border-t border-slate-100 px-4 py-6 dark:border-slate-800 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
                  Created
                </dt>
                <dd className="mt-1 text-sm leading-6  text-slate-700 dark:text-slate-300 sm:mt-2">
                  <RelativeTimeFormatter time={job.createdAt} addSuffix />
                </dd>
              </div>
            </dl>
          </div>

          <JobTimeline job={job} />

          <div className="sm:order-3 sm:col-span-2">
            <div>
              <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <div className="border-t border-slate-100 px-4 py-6 dark:border-slate-800 sm:col-span-2 sm:px-0">
                  <dt className="text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
                    Args
                  </dt>
                  <dd className="mt-1 text-sm leading-6  text-slate-700 dark:text-slate-300 sm:mt-2">
                    <pre className="overflow-scroll bg-slate-300/10 p-4 font-mono text-slate-900 dark:bg-slate-700/10 dark:text-slate-100">
                      {JSON.stringify(job.args, null, 2)}
                    </pre>
                  </dd>
                </div>
                <div className="border-t border-slate-100 px-4 py-6 dark:border-slate-800 sm:col-span-1 sm:px-0">
                  <dt className="text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
                    Metadata
                  </dt>
                  <dd className="mt-1 text-sm leading-6  text-slate-700 dark:text-slate-300 sm:mt-2">
                    <pre className="overflow-scroll bg-slate-300/10 p-4 font-mono text-slate-900 dark:bg-slate-700/10 dark:text-slate-100">
                      {JSON.stringify(job.metadata, null, 2)}
                    </pre>
                  </dd>
                </div>
                <div className="border-t border-slate-100 px-4 py-6 dark:border-slate-800 sm:col-span-1 sm:px-0">
                  <dt className="text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
                    Attempted By
                  </dt>
                  <dd className="mt-1 text-sm leading-6  text-slate-700 dark:text-slate-300 sm:mt-2">
                    <ul role="list">
                      {attemptsToDisplay.map((attemptedBy, i) => (
                        <li
                          className="font-mono"
                          key={i}
                          title={job.errors.at(i)?.at.toISOString()}
                        >
                          {attemptedBy}
                        </li>
                      ))}
                    </ul>
                    {!showAllAttempts && job.attemptedBy.length > 5 && (
                      <button
                        type="button"
                        className="mt-4 text-sm font-semibold text-indigo-600 hover:underline dark:text-slate-100"
                        onClick={() => setShowAllAttempts(true)}
                      >
                        Show all {job.attemptedBy.length} attempts
                      </button>
                    )}
                    {showAllAttempts && (
                      <button
                        type="button"
                        className="mt-4 text-sm font-semibold text-indigo-600 hover:underline dark:text-slate-100"
                        onClick={() => setShowAllAttempts(false)}
                      >
                        Show fewer attempts
                      </button>
                    )}
                  </dd>
                </div>

                <JobAttemptErrors job={job} />
              </dl>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
