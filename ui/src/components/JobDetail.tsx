import {
  ArrowUturnLeftIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import { Job } from "@services/jobs";
import { JobState } from "@services/types";
import { capitalize } from "@utils/string";
import JobTimeline from "./JobTimeline";
import { FormEvent, useMemo, useState } from "react";
import TopNavTitleOnly from "./TopNavTitleOnly";
import RelativeTimeFormatter from "./RelativeTimeFormatter";
import JobAttemptErrors from "./JobAttemptErrors";
import { Badge } from "./Badge";
import ButtonForGroup from "./ButtonForGroup";

type JobDetailProps = {
  cancel: () => void;
  deleteFn: () => void;
  job: Job;
  retry: () => void;
};

function ActionButtons({
  cancel,
  deleteFn,
  job,
  retry,
}: {
  cancel: () => void;
  deleteFn: () => void;
  job: Job;
  retry: () => void;
}) {
  // Can only delete jobs that aren't running:
  const deleteDisabled = job.state === JobState.Running;

  const deleteJob = (event: FormEvent) => {
    event.preventDefault();
    deleteFn();
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

  // Enable immediate retry if the job is not running or pending:
  const retryDisabled = [JobState.Running, JobState.Pending].includes(
    job.state
  );
  const retryJob = (event: FormEvent) => {
    event.preventDefault();
    retry();
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
      <ButtonForGroup
        Icon={TrashIcon}
        text="Delete"
        disabled={deleteDisabled}
        onClick={deleteJob}
      />
    </span>
  );
}

export default function JobDetail({
  cancel,
  deleteFn,
  job,
  retry,
}: JobDetailProps) {
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
              <ActionButtons
                cancel={cancel}
                deleteFn={deleteFn}
                job={job}
                retry={retry}
              />
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
                        <Badge
                          color="blue"
                          key={tag}
                          className="m-1 font-mono text-xs"
                        >
                          {tag}
                        </Badge>
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
