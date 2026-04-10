import ButtonForGroup from "@components/ButtonForGroup";
import { Subheading } from "@components/Heading";
import JSONView from "@components/JSONView";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import RetryWorkflowDialog from "@components/RetryWorkflowDialog";
import { TaskStateIcon } from "@components/TaskStateIcon";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import WorkflowDiagram from "@components/workflow-diagram/WorkflowDiagram";
import { useFeatures } from "@contexts/Features.hook";
// (Dialog is now encapsulated in RetryWorkflowDialog)
import { CheckIcon } from "@heroicons/react/16/solid";
import {
  ArrowPathIcon,
  ClipboardIcon,
  InformationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { toastSuccess } from "@services/toast";
import { JobState } from "@services/types";
import {
  Workflow,
  type WorkflowRetryMode,
  type WorkflowTask,
  type WorkflowTaskGate,
  type WorkflowTaskGateSatisfactionTimer,
  type WorkflowTaskGateTimer,
  type WorkflowTaskWaitReason,
} from "@services/workflows";
import { Link } from "@tanstack/react-router";
import { capitalize } from "@utils/string";
import clsx from "clsx";
import { useMemo, useState } from "react";

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

const dlClasses = "grid grid-cols-[130px_auto] text-base/6 sm:text-sm/6";
const dtClasses =
  "col-start-1 border-zinc-950/5 pt-2 text-zinc-500 first:border-none sm:border-zinc-950/5 sm:py-2 dark:border-white/5 dark:text-zinc-400 sm:dark:border-white/5";
const ddClasses =
  "pb-2 pt-1 text-zinc-950 sm:border-zinc-950/5 sm:py-2 dark:text-white dark:sm:border-white/5 sm:nth-2:border-none";

const SelectedJobDetails = ({
  job,
  jobsByTask,
}: {
  job: WorkflowTask;
  jobsByTask: JobsByTask;
}) => {
  const stagedAt = useMemo(() => job.stagedAt, [job.stagedAt]);

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

        <div className="order-first col-span-2 border-t border-slate-100 pt-4 sm:order-0 sm:col-span-1 sm:border-t-0 dark:border-slate-800">
          <Subheading>Workflow Task</Subheading>
          <dl className={dlClasses}>
            <dt className={dtClasses}>Task</dt>
            <dd className={ddClasses}>{job.name}</dd>
            <dt className={dtClasses}>Wait reason</dt>
            <dd className={ddClasses}>{formatWaitReason(job.waitReason)}</dd>
            <dt className={dtClasses}>Dependencies</dt>
            <dd className={ddClasses}>
              {job.deps.map((dep: string) => (
                <div className="flex items-center gap-2" key={dep}>
                  <DependencyItem depJob={jobsByTask[dep]} depName={dep} />
                </div>
              ))}
            </dd>
            <dt className={dtClasses}>Staged</dt>
            <dd className={ddClasses}>
              {job.state === JobState.Pending ? (
                <span>{getPendingStageLabel(job.waitReason)}</span>
              ) : (
                <RelativeTimeFormatter
                  addSuffix
                  time={stagedAt || job.createdAt}
                />
              )}
            </dd>
            <dt className={dtClasses}>Gate status</dt>
            <dd className={ddClasses}>
              {job.gate ? (
                <GateStatusPill gate={job.gate} />
              ) : (
                <span className="text-slate-500 dark:text-slate-400">None</span>
              )}
            </dd>
          </dl>
        </div>

        {job.gate && (
          <div className="col-span-2 border-t border-slate-100 py-4 sm:px-0 dark:border-slate-800">
            <Subheading>Gate</Subheading>
            <dl className={dlClasses}>
              <dt className={dtClasses}>State</dt>
              <dd className={ddClasses}>{getGateStatusLabel(job.gate)}</dd>
              <dt className={dtClasses}>Expression</dt>
              <dd className={ddClasses}>
                {job.gate.exprCel || "No expression"}
              </dd>
              <dt className={dtClasses}>Blocking</dt>
              <dd className={ddClasses}>
                {isGateBlocking(job.gate)
                  ? "Blocking this task"
                  : "Not blocking"}
              </dd>
              <dt className={dtClasses}>Phase</dt>
              <dd className={ddClasses}>{job.gate.phase}</dd>
              <dt className={dtClasses}>Activated</dt>
              <dd className={ddClasses}>
                {job.gate.activeAt ? (
                  <RelativeTimeFormatter addSuffix time={job.gate.activeAt} />
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    Not activated yet
                  </span>
                )}
              </dd>
              <dt className={dtClasses}>Satisfied</dt>
              <dd className={ddClasses}>
                {job.gate.satisfiedAt ? (
                  <RelativeTimeFormatter
                    addSuffix
                    time={job.gate.satisfiedAt}
                  />
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    Not satisfied yet
                  </span>
                )}
              </dd>
              <dt className={dtClasses}>Declared signals</dt>
              <dd className={ddClasses}>
                <GateDeclaredSignals signals={job.gate.declaredSignals} />
              </dd>
              <dt className={dtClasses}>Timers</dt>
              <dd className={ddClasses}>
                <GateTimers
                  satisfactionTimers={job.gate.satisfaction?.timers}
                  timers={job.gate.timers}
                />
              </dd>
              <dt className={dtClasses}>Satisfaction snapshot</dt>
              <dd className={ddClasses}>
                <GateSatisfactionSummary satisfaction={job.gate.satisfaction} />
              </dd>
            </dl>
          </div>
        )}

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

const GateStatusPill = ({ gate }: { gate: WorkflowTaskGate }) => {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
        isGateBlocking(gate)
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
          : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
      )}
      title={getGateStatusLabel(gate)}
    >
      <InformationCircleIcon className="size-3" />
      {getGateStatusLabel(gate)}
    </span>
  );
};

const isGateBlocking = (gate: WorkflowTaskGate): boolean => {
  return gate.phase !== "satisfied";
};

const getGateStatusLabel = (gate: WorkflowTaskGate): string => {
  switch (gate.phase) {
    case "inactive":
      return "Gate inactive";
    case "satisfied":
      return "Gate satisfied";
    case "waiting":
      return "Gate pending";
    default:
      return isGateBlocking(gate) ? "Gate pending" : "Gate status unknown";
  }
};

const GateDeclaredSignals = ({ signals }: { signals: string[] }) => {
  if (signals.length === 0) {
    return (
      <span className="text-slate-500 dark:text-slate-400">
        No declared signal keys
      </span>
    );
  }

  return (
    <div className="space-y-1">
      {signals.map((signal) => (
        <div className="font-mono text-xs" key={signal}>
          {signal}
        </div>
      ))}
    </div>
  );
};

const GateTimers = ({
  satisfactionTimers,
  timers,
}: {
  satisfactionTimers?: WorkflowTaskGateSatisfactionTimer[];
  timers: WorkflowTaskGateTimer[];
}) => {
  if (timers.length === 0) {
    return (
      <span className="text-slate-500 dark:text-slate-400">
        No gate timers declared
      </span>
    );
  }

  const satisfactionTimerByName = new Map(
    (satisfactionTimers ?? []).map((timer) => [timer.name, timer]),
  );

  return (
    <div className="space-y-1">
      {timers.map((timer) => (
        <div className="font-mono text-xs" key={timer.name}>
          <span className="font-semibold">{timer.name}</span>
          {timer.anchor ? (
            <span className="ml-2 font-sans text-slate-500 dark:text-slate-400">
              anchor {timer.anchor.kind}
              {timer.anchor.task ? `(${timer.anchor.task})` : ""}
            </span>
          ) : null}
          {typeof timer.afterSeconds === "number" ? (
            <span className="ml-2 font-sans">
              +{timer.afterSeconds.toFixed(1)}s
            </span>
          ) : null}
          {timer.fireAt ? (
            <span className="ml-2 font-sans">
              fire at <RelativeTimeFormatter addSuffix time={timer.fireAt} />
            </span>
          ) : null}
          {satisfactionTimerByName.get(timer.name)?.fired ? (
            <span className="ml-2 font-sans text-green-700 dark:text-green-300">
              fired
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
};

const GateSatisfactionSummary = ({
  satisfaction,
}: {
  satisfaction?: WorkflowTaskGate["satisfaction"];
}) => {
  if (!satisfaction) {
    return (
      <span className="text-slate-500 dark:text-slate-400">
        No satisfaction snapshot yet
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <div className="font-mono text-xs">
        satisfied <RelativeTimeFormatter addSuffix time={satisfaction.asOf} />{" "}
        on attempt {satisfaction.attempt}
      </div>
      {satisfaction.signals.map((signal) => (
        <div className="font-mono text-xs" key={signal.key}>
          <span className="font-semibold">{signal.key}</span>
          <span className="ml-2 font-sans">count {signal.count}</span>
          {signal.lastSignalId ? (
            <span className="ml-2 font-sans">
              last #{signal.lastSignalId.toString()}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
};
