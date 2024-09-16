import { Workflow } from "@services/workflows";
import WorkflowDiagram from "@components/WorkflowDiagram";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";

import { capitalize } from "@utils/string";
import { Subheading } from "@components/Heading";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import { JobWithKnownMetadata } from "@services/jobs";
import { TaskStateIcon } from "@components/TaskStateIcon";
import { Button } from "@components/Button";
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import { JobState } from "@services/types";

type JobsByTask = {
  [key: string]: JobWithKnownMetadata;
};

type WorkflowDetailProps = {
  selectedJobId: bigint | undefined;
  setSelectedJobId: (jobId: bigint | undefined) => void;
  workflow: Workflow;
};

export default function WorkflowDetail({
  selectedJobId,
  setSelectedJobId,
  workflow,
}: WorkflowDetailProps) {
  const { tasks } = workflow;
  const selectedJob = useMemo(
    () => tasks.find((task) => task.id === selectedJobId),
    [tasks, selectedJobId]
  );
  const firstTask = tasks[0];
  // TODO: this is being repeated in WorkflowDiagram, dedupe
  const jobsByTask: JobsByTask = tasks.reduce((acc: JobsByTask, job) => {
    acc[job.metadata.task] = job;
    return acc;
  }, {});

  return (
    <>
      <TopNavTitleOnly title="Workflow Detail" />
      <header>
        {/* Heading */}
        <div className="mb-4 flex flex-col items-start justify-between gap-x-8 gap-y-4 bg-gray-300/10 p-4 dark:bg-gray-700/10 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <h1 className="flex gap-x-3 text-2xl leading-7">
              <span className="font-semibold text-slate-900 dark:text-white">
                {firstTask.metadata.workflow_name || "Unnamed Workflow"}
              </span>
            </h1>
            <p className="mt-2 text-base leading-6 text-slate-600 dark:text-slate-400">
              ID:{" "}
              <span className="font-mono">
                {firstTask.metadata.workflow_id}
              </span>
            </p>
          </div>
          <div className="order-none flex w-full justify-around sm:block sm:w-auto sm:flex-none">
            <Button color="light">
              <EllipsisHorizontalIcon className="size-6 text-red-500 dark:text-red-500" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto h-[500px] overflow-hidden border-2 border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 md:mx-7 md:rounded-lg">
        <WorkflowDiagram
          selectedJobId={selectedJobId}
          setSelectedJobId={setSelectedJobId}
          tasks={tasks}
        />
      </div>
      <div className="mx-7 my-4">
        {selectedJob && (
          <SelectedJobDetails job={selectedJob} jobsByTask={jobsByTask} />
        )}
      </div>
    </>
  );
}

const dlClasses = "grid grid-cols-[130px_auto] text-base/6 sm:text-sm/6";
const dtClasses =
  "col-start-1 border-zinc-950/5 pt-2 text-zinc-500 first:border-none sm:border-zinc-950/5 sm:py-2 dark:border-white/5 dark:text-zinc-400 sm:dark:border-white/5";
const ddClasses =
  "pb-2 pt-1 text-zinc-950 sm:border-zinc-950/5 sm:py-2 dark:text-white dark:sm:border-white/5 sm:[&:nth-child(2)]:border-none";

const SelectedJobDetails = ({
  job,
  jobsByTask,
}: {
  job: JobWithKnownMetadata;
  jobsByTask: JobsByTask;
}) => {
  const stagedAt = useMemo(
    () =>
      job.metadata.workflow_staged_at
        ? new Date(job.metadata.workflow_staged_at)
        : undefined,
    [job.metadata.workflow_staged_at]
  );

  return (
    <>
      <div className="mx-auto grid grid-cols-2 gap-6 pb-16">
        <div className="col-span-2 pt-4 sm:col-span-1">
          <Subheading>Job Details</Subheading>
          <dl className={dlClasses}>
            <dt className={dtClasses}>ID</dt>
            <dd className={ddClasses}>
              <Link
                to="/jobs/$jobId"
                params={{ jobId: job.id }}
                className="font-mono text-slate-900 dark:text-slate-200"
              >
                <span className="truncate">{job.id.toString()}</span>
              </Link>
            </dd>

            <dt className={dtClasses}>State</dt>
            <dd className={clsx(ddClasses, "flex items-center")}>
              {capitalize(job.state)}
              <TaskStateIcon jobState={job.state} className="ml-2 size-4" />
            </dd>

            <dt className={dtClasses}>Kind</dt>
            <dd className={clsx(ddClasses, "font-mono")}>{job.kind}</dd>

            <dt className={dtClasses}>Attempt</dt>
            <dd className={ddClasses}>
              {job.attempt.toString()} / {job.maxAttempts.toString()}
            </dd>

            <dt className={dtClasses}>Queue</dt>
            <dd className={clsx(ddClasses, "font-mono")}>{job.queue}</dd>

            <dt className={dtClasses}>Priority</dt>
            <dd className={ddClasses}>{job.priority}</dd>

            <dt className={dtClasses}>Created</dt>
            <dd className={ddClasses}>
              <RelativeTimeFormatter time={job.createdAt} addSuffix />
            </dd>
          </dl>
        </div>

        <div className="order-first col-span-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:order-none sm:col-span-1 sm:border-t-0">
          <Subheading>Workflow Task</Subheading>
          <dl className={dlClasses}>
            <dt className={dtClasses}>Task</dt>
            <dd className={ddClasses}>{job.metadata.task}</dd>
            <dt className={dtClasses}>Dependencies</dt>
            <dd className={ddClasses}>
              {job.metadata.deps &&
                job.metadata.deps.map((dep: string) => (
                  <div className="flex items-center gap-2" key={dep}>
                    <DependencyItem depName={dep} depJob={jobsByTask[dep]} />
                  </div>
                ))}
            </dd>
            <dt className={dtClasses}>Staged</dt>
            <dd className={ddClasses}>
              {job.state === JobState.Pending ? (
                <span>Not yet staged, pending dependencies</span>
              ) : (
                <RelativeTimeFormatter
                  time={stagedAt || job.createdAt}
                  addSuffix
                />
              )}
            </dd>
          </dl>
        </div>

        <div className="col-span-2 border-t border-slate-100 py-4 text-sm dark:border-slate-800 sm:col-span-1 sm:px-0">
          <dt className={dtClasses}>Args</dt>
          <dd className={clsx(ddClasses, "text-base leading-6 sm:text-sm")}>
            <pre className="overflow-scroll bg-slate-300/10 p-4 font-mono text-slate-900 dark:bg-slate-700/10 dark:text-slate-100">
              {JSON.stringify(job.args, null, 2)}
            </pre>
          </dd>
        </div>
        <div className="col-span-2 border-t border-slate-100 py-4 text-sm dark:border-slate-800 sm:col-span-1 sm:px-0">
          <dt className={dtClasses}>Metadata</dt>
          <dd className={clsx(ddClasses, "text-base leading-6 sm:text-sm")}>
            {/* <dd className="mt-1 text-sm leading-6  text-slate-700 dark:text-slate-300 sm:mt-2"> */}
            <pre className="overflow-scroll bg-slate-300/10 p-4 font-mono text-slate-800 dark:bg-slate-700/10 dark:text-slate-200">
              {JSON.stringify(job.metadata, null, 2)}
            </pre>
          </dd>
        </div>
      </div>
    </>
  );
};

const DependencyItem = ({
  depJob,
  depName,
}: {
  depJob?: JobWithKnownMetadata;
  depName: string;
}) => {
  if (!depJob) {
    return (
      <div className="flex items-center gap-x-2 font-mono text-slate-900 dark:text-slate-200">
        <TaskStateIcon jobState={JobState.Discarded} className="size-4" />
        <span className="truncate">{depName}</span>
      </div>
    );
  }

  return (
    <Link
      to="."
      search={{ selected: depJob.id }}
      className="flex items-center gap-x-2 font-mono text-slate-900 dark:text-slate-200"
    >
      <TaskStateIcon jobState={depJob.state} className="size-4" />
      <span className="truncate">{depName}</span>
    </Link>
  );
};
