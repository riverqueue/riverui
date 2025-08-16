import { Button } from "@components/Button";
import { Subheading } from "@components/Heading";
import JSONView from "@components/JSONView";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import { TaskStateIcon } from "@components/TaskStateIcon";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import WorkflowDiagram from "@components/WorkflowDiagram";
import { useFeatures } from "@contexts/Features.hook";
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import { Workflow } from "@services/workflows";
import { Link } from "@tanstack/react-router";
import { capitalize } from "@utils/string";
import clsx from "clsx";
import { useMemo } from "react";

import WorkflowListEmptyState from "./WorkflowListEmptyState";

type JobsByTask = {
  [key: string]: JobWithKnownMetadata;
};

type WorkflowDetailProps = {
  loading: boolean;
  selectedJobId: bigint | undefined;
  setSelectedJobId: (jobId: bigint | undefined) => void;
  workflow: undefined | Workflow;
};

export default function WorkflowDetail({
  loading,
  selectedJobId,
  setSelectedJobId,
  workflow,
}: WorkflowDetailProps) {
  const { features } = useFeatures();

  // Move all hooks to the top, before any conditional returns
  const selectedJob = useMemo(
    () => workflow?.tasks?.find((task) => task.id === selectedJobId),
    [workflow?.tasks, selectedJobId],
  );

  const firstTask = workflow?.tasks?.[0];
  // TODO: this is being repeated in WorkflowDiagram, dedupe
  const jobsByTask: JobsByTask = useMemo(() => {
    if (!workflow?.tasks) return {};
    return workflow.tasks.reduce((acc: JobsByTask, job) => {
      acc[job.metadata.task] = job;
      return acc;
    }, {});
  }, [workflow?.tasks]);

  if (!features.workflowQueries) {
    return (
      <div>
        <WorkflowListEmptyState showingAll={false} />
      </div>
    );
  }

  if (loading) {
    return <h4>loading…</h4>;
  }

  if (!workflow?.tasks) {
    return <h4>No workflow data available</h4>;
  }

  const { tasks } = workflow;

  // Ensure firstTask exists before rendering
  if (!firstTask) {
    return <h4>No tasks available</h4>;
  }

  return (
    <>
      <TopNavTitleOnly title="Workflow Detail" />
      <header>
        {/* Heading */}
        <div className="mb-4 flex flex-col items-start justify-between gap-x-8 gap-y-4 bg-gray-300/10 p-4 sm:flex-row sm:items-center sm:px-6 lg:px-8 dark:bg-gray-700/10">
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

      <div className="mx-auto h-[500px] overflow-hidden border-2 border-slate-200 bg-slate-100 md:mx-7 md:rounded-lg dark:border-slate-800 dark:bg-slate-800/50">
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
  "pb-2 pt-1 text-zinc-950 sm:border-zinc-950/5 sm:py-2 dark:text-white dark:sm:border-white/5 sm:nth-2:border-none";

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
    [job.metadata.workflow_staged_at],
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
                className="font-mono text-slate-900 dark:text-slate-200"
                params={{ jobId: job.id }}
                to="/jobs/$jobId"
              >
                <span className="truncate">{job.id.toString()}</span>
              </Link>
            </dd>

            <dt className={dtClasses}>State</dt>
            <dd className={clsx(ddClasses, "flex items-center")}>
              {capitalize(job.state)}
              <TaskStateIcon className="ml-2 size-4" jobState={job.state} />
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
              <RelativeTimeFormatter addSuffix time={job.createdAt} />
            </dd>
          </dl>
        </div>

        <div className="order-first col-span-2 border-t border-slate-100 pt-4 sm:order-none sm:col-span-1 sm:border-t-0 dark:border-slate-800">
          <Subheading>Workflow Task</Subheading>
          <dl className={dlClasses}>
            <dt className={dtClasses}>Task</dt>
            <dd className={ddClasses}>{job.metadata.task}</dd>
            <dt className={dtClasses}>Dependencies</dt>
            <dd className={ddClasses}>
              {job.metadata.deps &&
                job.metadata.deps.map((dep: string) => (
                  <div className="flex items-center gap-2" key={dep}>
                    <DependencyItem depJob={jobsByTask[dep]} depName={dep} />
                  </div>
                ))}
            </dd>
            <dt className={dtClasses}>Staged</dt>
            <dd className={ddClasses}>
              {job.state === JobState.Pending ? (
                <span>Not yet staged, pending dependencies</span>
              ) : (
                <RelativeTimeFormatter
                  addSuffix
                  time={stagedAt || job.createdAt}
                />
              )}
            </dd>
          </dl>
        </div>

        <div className="col-span-2 border-t border-slate-100 py-4 text-sm sm:col-span-1 sm:px-0 dark:border-slate-800">
          <dt className={dtClasses}>Args</dt>
          <dd className={clsx(ddClasses, "text-base leading-6 sm:text-sm")}>
            <JSONView copyTitle="Args" data={job.args} />
          </dd>
        </div>
        <div className="col-span-2 border-t border-slate-100 py-4 text-sm sm:col-span-1 sm:px-0 dark:border-slate-800">
          <dt className={dtClasses}>Metadata</dt>
          <dd className={clsx(ddClasses, "text-base leading-6 sm:text-sm")}>
            <JSONView
              copyTitle="Metadata"
              data={job.metadata}
              defaultExpandDepth={0}
            />
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
        <TaskStateIcon className="size-4" jobState={JobState.Discarded} />
        <span className="truncate">{depName}</span>
      </div>
    );
  }

  return (
    <Link
      className="flex items-center gap-x-2 font-mono text-slate-900 dark:text-slate-200"
      search={{ selected: depJob.id }}
      to="."
    >
      <TaskStateIcon className="size-4" jobState={depJob.state} />
      <span className="truncate">{depName}</span>
    </Link>
  );
};
