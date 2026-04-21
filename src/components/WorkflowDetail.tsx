import ButtonForGroup from "@components/ButtonForGroup";
import { Subheading } from "@components/Heading";
import JSONView from "@components/JSONView";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import RetryWorkflowDialog from "@components/RetryWorkflowDialog";
import { TaskStateIcon } from "@components/TaskStateIcon";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import WorkflowDiagram from "@components/workflow-diagram/WorkflowDiagram";
import WorkflowGateInspector from "@components/WorkflowGateInspector";
import { useFeatures } from "@contexts/Features.hook";
// (Dialog is now encapsulated in RetryWorkflowDialog)
import { CheckIcon } from "@heroicons/react/16/solid";
import {
  ArrowPathIcon,
  ClipboardIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { toastSuccess } from "@services/toast";
import { JobState } from "@services/types";
import {
  Workflow,
  type WorkflowRetryMode,
  type WorkflowTask,
  type WorkflowTaskWaitReason,
} from "@services/workflows";
import { Link } from "@tanstack/react-router";
import { capitalize } from "@utils/string";
import clsx from "clsx";
import { type ReactNode, useMemo, useState } from "react";

import WorkflowListEmptyState from "./WorkflowListEmptyState";

type JobsByTask = {
  [key: string]: WorkflowTask;
};

type WorkflowDetailProps = {
  cancelPending?: boolean;
  loading: boolean;
  onCancel?: () => void;
  onRetry?: (mode: WorkflowRetryMode, resetHistory: boolean) => void;
  retryPending?: boolean;
  selectedJobId: bigint | undefined;
  setSelectedJobId: (jobId: bigint | undefined) => void;
  workflow: undefined | Workflow;
};

export default function WorkflowDetail({
  cancelPending,
  loading,
  onCancel,
  onRetry,
  retryPending,
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
  const workflowID = workflow?.id;
  // TODO: this is being repeated in WorkflowDiagram, dedupe
  const jobsByTask: JobsByTask = workflow?.tasks
    ? workflow.tasks.reduce((acc: JobsByTask, job) => {
        acc[job.name] = job;
        return acc;
      }, {})
    : {};

  const isActive = useMemo(() => {
    const activeStates = new Set<JobState>([
      JobState.Available,
      JobState.Pending,
      JobState.Retryable,
      JobState.Running,
      JobState.Scheduled,
    ]);
    return Boolean(workflow?.tasks?.some((t) => activeStates.has(t.state)));
  }, [workflow?.tasks]);

  // Modal state for retry
  const [retryOpen, setRetryOpen] = useState(false);
  const [retryMode, setRetryMode] = useState<undefined | WorkflowRetryMode>();
  const [workflowNameCopied, setWorkflowNameCopied] = useState(false);

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

  // Ensure firstTask exists before rendering
  if (!firstTask) {
    return <h4>No tasks available</h4>;
  }
  const { tasks } = workflow;
  const workflowName =
    workflow.name === "" ? "Unnamed Workflow" : workflow.name;

  return (
    <>
      <TopNavTitleOnly title="Workflow Detail" />
      <header>
        {/* Heading */}
        <div className="mb-4 flex flex-col items-start justify-between gap-x-8 gap-y-4 bg-gray-300/10 p-4 sm:flex-row sm:items-center sm:px-6 lg:px-8 dark:bg-gray-700/10">
          <div className="w-full min-w-0 flex-1">
            <h1 className="text-2xl leading-7">
              <span className="inline-flex max-w-full items-center gap-x-2">
                <span
                  className="block min-w-0 truncate font-semibold text-slate-900 dark:text-white"
                  title={workflowName}
                >
                  {workflowName}
                </span>
                <button
                  className="inline-flex shrink-0 cursor-pointer items-center rounded p-1 text-slate-500 hover:text-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary dark:text-slate-400 dark:hover:text-brand-primary"
                  onClick={() => {
                    if (!navigator.clipboard?.writeText) {
                      console.error(
                        "Failed to copy workflow name: Clipboard API unavailable",
                      );
                      return;
                    }

                    navigator.clipboard.writeText(workflowName).then(
                      () => {
                        setWorkflowNameCopied(true);
                        toastSuccess({
                          message: "Workflow name copied to clipboard",
                        });
                        setTimeout(() => setWorkflowNameCopied(false), 2000);
                      },
                      (error: unknown) => {
                        console.error(
                          "Failed to copy workflow name to clipboard:",
                          error,
                        );
                      },
                    );
                  }}
                  title="Copy workflow name"
                  type="button"
                >
                  {workflowNameCopied ? (
                    <CheckIcon
                      aria-hidden="true"
                      className="size-4 text-green-500"
                    />
                  ) : (
                    <ClipboardIcon aria-hidden="true" className="size-4" />
                  )}
                </button>
              </span>
            </h1>
            <p className="mt-2 text-base leading-6 text-slate-600 dark:text-slate-400">
              ID: <span className="font-mono">{workflow.id}</span>
            </p>
          </div>
          <div className="order-0 flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-none">
            <span className="isolate inline-flex rounded-md shadow-xs">
              <ButtonForGroup
                disabled={retryPending || !workflowID || isActive}
                onClick={() => setRetryOpen(true)}
              >
                <ArrowPathIcon aria-hidden="true" className="mr-2 size-5" />
                Retry
              </ButtonForGroup>

              <ButtonForGroup
                disabled={cancelPending || !workflowID || !isActive}
                onClick={onCancel}
              >
                <XCircleIcon aria-hidden="true" className="mr-2 size-5" />
                Cancel
              </ButtonForGroup>
            </span>
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

      <RetryWorkflowDialog
        defaultMode={retryMode}
        onClose={() => setRetryOpen(false)}
        onConfirm={(mode, reset) => {
          onRetry?.(mode, reset);
          setRetryOpen(false);
          setRetryMode(undefined);
        }}
        open={retryOpen}
        pending={retryPending}
      />
    </>
  );
}

const inspectorCardClasses =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900";
const inspectorListClasses = "space-y-3";
const inspectorLabelClasses = "text-sm text-slate-500 dark:text-slate-400";
const inspectorValueClasses =
  "min-w-0 text-sm text-slate-900 dark:text-slate-100";

const SelectedJobDetails = ({
  job,
  jobsByTask,
}: {
  job: WorkflowTask;
  jobsByTask: JobsByTask;
}) => {
  const stagedAt = useMemo(() => job.stagedAt, [job.stagedAt]);

  return (
    <div className="mx-auto grid gap-6 pb-16 xl:grid-cols-2">
      <div className={clsx(inspectorCardClasses, "pt-4")}>
        <Subheading className="mb-4">Job Details</Subheading>
        <dl className={inspectorListClasses}>
          <InspectorRow
            label="ID"
            value={
              <Link
                className="font-mono text-slate-900 dark:text-slate-200"
                params={{ jobId: job.id }}
                to="/jobs/$jobId"
              >
                <span className="truncate">{job.id.toString()}</span>
              </Link>
            }
          />
          <InspectorRow
            label="State"
            value={
              <span className="flex items-center gap-2">
                {capitalize(job.state)}
                <TaskStateIcon className="size-4" jobState={job.state} />
              </span>
            }
          />
          <InspectorRow
            label="Kind"
            value={<span className="font-mono">{job.kind}</span>}
          />
          <InspectorRow
            label="Attempt"
            value={`${job.attempt.toString()} / ${job.maxAttempts.toString()}`}
          />
          <InspectorRow
            label="Queue"
            value={<span className="font-mono">{job.queue}</span>}
          />
          <InspectorRow label="Priority" value={job.priority} />
          <InspectorRow
            label="Created"
            value={<RelativeTimeFormatter addSuffix time={job.createdAt} />}
          />
        </dl>

        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <Subheading className="mb-3 text-sm/6">Args</Subheading>
          <JSONView copyTitle="Args" data={job.args} />
        </div>
      </div>

      <div className={clsx(inspectorCardClasses, "pt-4")}>
        <Subheading className="mb-4">Workflow Task</Subheading>
        <dl className={inspectorListClasses}>
          <InspectorRow label="Task" value={job.name} />
          <InspectorRow
            label="Wait reason"
            value={formatWaitReason(job.waitReason)}
          />
          <InspectorRow
            label="Dependencies"
            value={
              job.deps.length > 0 ? (
                <div className="space-y-1.5">
                  {job.deps.map((dep: string) => (
                    <div className="flex items-center gap-2" key={dep}>
                      <DependencyItem depJob={jobsByTask[dep]} depName={dep} />
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">
                  No dependencies
                </span>
              )
            }
          />
          <InspectorRow
            label="Staged"
            value={
              job.state === JobState.Pending ? (
                <span>{getPendingStageLabel(job.waitReason)}</span>
              ) : (
                <RelativeTimeFormatter
                  addSuffix
                  time={stagedAt || job.createdAt}
                />
              )
            }
          />
        </dl>

        {job.gate ? (
          <WorkflowGateInspector gate={job.gate} waitReason={job.waitReason} />
        ) : null}
      </div>

      <div className={clsx(inspectorCardClasses, "pt-4 text-sm xl:col-span-2")}>
        <Subheading className="mb-4">Metadata</Subheading>
        <JSONView
          copyTitle="Metadata"
          data={job.metadata}
          defaultExpandDepth={0}
        />
      </div>
    </div>
  );
};

const InspectorRow = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => {
  return (
    <div className="grid gap-x-4 gap-y-1 sm:grid-cols-[112px_minmax(0,1fr)]">
      <dt className={inspectorLabelClasses}>{label}</dt>
      <dd className={inspectorValueClasses}>{value}</dd>
    </div>
  );
};

const DependencyItem = ({
  depJob,
  depName,
}: {
  depJob?: WorkflowTask;
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

const formatWaitReason = (waitReason: WorkflowTaskWaitReason): string => {
  switch (waitReason) {
    case "dependencies":
      return "Waiting on dependencies";
    case "dependencies_and_gate":
      return "Waiting on dependencies and gate";
    case "gate":
      return "Waiting on gate";
    case "none":
    default:
      return "Not waiting";
  }
};

const getPendingStageLabel = (waitReason: WorkflowTaskWaitReason): string => {
  switch (waitReason) {
    case "dependencies":
      return "Not yet staged, pending dependencies";
    case "dependencies_and_gate":
      return "Not yet staged, pending dependencies and gate";
    case "gate":
      return "Not yet staged, waiting on gate";
    case "none":
    default:
      return "Not yet staged";
  }
};
