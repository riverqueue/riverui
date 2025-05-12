import { Badge } from "@components/Badge";
import ButtonForGroup from "@components/ButtonForGroup";
import JobAttempts from "@components/JobAttempts";
import JobTimeline from "@components/JobTimeline";
import JSONView from "@components/JSONView";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import {
  ArrowUturnLeftIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import useFeature from "@hooks/use-feature";
import { Job, JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import { Link } from "@tanstack/react-router";
import { capitalize } from "@utils/string";
import { FormEvent } from "react";

type JobDetailProps = {
  cancel: () => void;
  deleteFn: () => void;
  job: Job;
  retry: () => void;
};

export default function JobDetail({
  cancel,
  deleteFn,
  job,
  retry,
}: JobDetailProps) {
  const featureEnabledWorkflows = useFeature("ENABLE_WORKFLOWS", true);

  let jobWithMetadata: JobWithKnownMetadata | undefined;
  if (isJobWithKnownMetadata(job)) {
    jobWithMetadata = job;
  }

  return (
    <>
      <TopNavTitleOnly title="Job Details" />
      <main>
        <header>
          {/* Heading */}
          <div className="mb-8 flex flex-col items-start justify-between gap-x-8 gap-y-4 bg-gray-300/10 p-4 sm:flex-row sm:items-center sm:px-6 lg:px-8 dark:bg-gray-700/10">
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

        <div className="mx-auto grid grid-cols-1 gap-8 pb-16 sm:grid-cols-2 sm:px-6 lg:px-8">
          {/* Description list */}
          <div className="">
            <dl className="grid grid-cols-12">
              <div className="col-span-4 border-t border-slate-100 p-4 sm:px-0 dark:border-slate-800">
                <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
                  State
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300">
                  {capitalize(job.state)}
                </dd>
              </div>
              <div className="col-span-4 border-t border-slate-100 p-4 sm:px-0 dark:border-slate-800">
                <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
                  Attempt
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300">
                  {job.attempt.toString()} / {job.maxAttempts.toString()}
                </dd>
              </div>
              <div className="col-span-4 border-t border-slate-100 p-4 sm:px-0 dark:border-slate-800">
                <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
                  Priority
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300">
                  {job.priority.toString()}
                </dd>
              </div>
              <div className="col-span-6 border-t border-slate-100 p-4 sm:px-0 dark:border-slate-800">
                <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
                  Queue
                </dt>
                <dd className="mt-1 flex overflow-hidden font-mono text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300">
                  {job.queue}
                </dd>
              </div>
              <div className="col-span-6 border-t border-slate-100 p-4 sm:px-0 dark:border-slate-800">
                <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
                  Tags
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300">
                  {job.tags.length == 0
                    ? "–"
                    : job.tags.map((tag) => (
                        <Badge
                          className="m-1 font-mono text-xs"
                          color="blue"
                          key={tag}
                        >
                          {tag}
                        </Badge>
                      ))}
                </dd>
              </div>
              <div className="col-span-6 border-t border-slate-100 p-4 sm:px-0 dark:border-slate-800">
                <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
                  Created
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300">
                  <RelativeTimeFormatter addSuffix time={job.createdAt} />
                </dd>
              </div>
              {featureEnabledWorkflows &&
                jobWithMetadata &&
                jobWithMetadata.metadata.workflow_id && (
                  <div className="col-span-6 border-t border-slate-100 p-4 sm:px-0 dark:border-slate-800">
                    <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
                      Workflow
                    </dt>
                    <dd className="mt-1 overflow-hidden font-mono text-sm leading-6 text-ellipsis text-slate-700 sm:mt-2 dark:text-slate-300">
                      {jobWithMetadata.metadata.workflow_id ? (
                        <Link
                          params={{
                            workflowId: jobWithMetadata.metadata.workflow_id,
                          }}
                          search={{ selected: job.id }}
                          to="/workflows/$workflowId"
                        >
                          {jobWithMetadata.metadata.workflow_id}
                        </Link>
                      ) : (
                        "–"
                      )}
                    </dd>
                  </div>
                )}
            </dl>
          </div>

          <JobTimeline job={job} />

          <div className="col-span-1 sm:order-3 sm:col-span-2">
            <dl className="grid-cols-1 gap-x-4 border-slate-100 md:grid md:grid-cols-2 md:border-t dark:border-slate-800">
              <div className="col-span-1 border-t border-slate-100 px-4 py-6 sm:px-0 md:border-t-0 dark:border-slate-800">
                <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
                  Args
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300">
                  <JSONView copyTitle="Args" data={job.args} />
                </dd>
              </div>
              <div className="col-span-1 border-t border-slate-100 px-4 py-6 sm:px-0 dark:border-slate-800">
                <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
                  Metadata
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300">
                  <JSONView copyTitle="Metadata" data={job.metadata} />
                </dd>
              </div>

              <JobAttempts job={job} />
            </dl>
          </div>
        </div>
      </main>
    </>
  );
}

function ActionButtons({ cancel, deleteFn, job, retry }: JobDetailProps) {
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
  const retryDisabled = [JobState.Pending, JobState.Running].includes(
    job.state,
  );
  const retryJob = (event: FormEvent) => {
    event.preventDefault();
    retry();
  };

  return (
    <span className="isolate inline-flex rounded-md shadow-xs">
      <ButtonForGroup
        disabled={retryDisabled}
        Icon={ArrowUturnLeftIcon}
        onClick={retryJob}
        text="Retry"
      />
      <ButtonForGroup
        disabled={cancelDisabled}
        Icon={XCircleIcon}
        onClick={cancelJob}
        text="Cancel"
      />
      <ButtonForGroup
        disabled={deleteDisabled}
        Icon={TrashIcon}
        onClick={deleteJob}
        text="Delete"
      />
    </span>
  );
}

function isJobWithKnownMetadata(job: Job): job is JobWithKnownMetadata {
  return (job as JobWithKnownMetadata).metadata !== undefined;
}
