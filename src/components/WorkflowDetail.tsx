import ButtonForGroup from "@components/ButtonForGroup";
import { DurationCompact } from "@components/DurationCompact";
import { Subheading } from "@components/Heading";
import { RunningSpinnerIcon } from "@components/icons/jobStateIcons";
import JSONView from "@components/JSONView";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import RetryWorkflowDialog from "@components/RetryWorkflowDialog";
import { TaskStateIcon } from "@components/TaskStateIcon";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import WorkflowDiagram from "@components/workflow-diagram/WorkflowDiagram";
import WorkflowGateInspector, {
  ConditionKindIcon,
  type WaitConditionFocusRequest,
  WaitConditionStatusPill,
} from "@components/WorkflowGateInspector";
import { useFeatures } from "@contexts/Features.hook";
// (Dialog is now encapsulated in RetryWorkflowDialog)
import { CheckIcon } from "@heroicons/react/16/solid";
import {
  ArrowPathIcon,
  ClipboardIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon,
  PlayCircleIcon,
  QueueListIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { toastSuccess } from "@services/toast";
import { type Heroicon, JobState } from "@services/types";
import {
  Workflow,
  type WorkflowRetryMode,
  type WorkflowTask,
  type WorkflowTaskWaitReason,
} from "@services/workflows";
import { Link } from "@tanstack/react-router";
import { capitalize } from "@utils/string";
import clsx from "clsx";
import { compareAsc } from "date-fns";
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
  const [waitConditionFocusRequest, setWaitConditionFocusRequest] =
    useState<WaitConditionFocusRequest>();
  const handleSelectWaitCondition = (conditionName: string) => {
    setWaitConditionFocusRequest((current) => ({
      conditionName,
      requestID: (current?.requestID ?? 0) + 1,
    }));
  };

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

        <div className="mt-5 border-t border-slate-200 pt-5 text-sm dark:border-slate-800">
          <Subheading className="mb-3 text-sm/6">Metadata</Subheading>
          <JSONView
            copyTitle="Metadata"
            data={job.metadata}
            defaultExpandDepth={0}
          />
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
          {job.wait ? (
            <InspectorRow
              label="Wait condition"
              value={<WaitConditionStatusPill wait={job.wait} />}
            />
          ) : null}
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

        <TaskTimeline
          job={job}
          jobsByTask={jobsByTask}
          onSelectWaitCondition={handleSelectWaitCondition}
        />

        {job.wait ? (
          <WorkflowGateInspector
            dependencyTasks={jobsByTask}
            focusRequest={waitConditionFocusRequest}
            onSelectCondition={handleSelectWaitCondition}
            taskName={job.name}
            wait={job.wait}
            workflowID={job.workflowID}
          />
        ) : null}
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
      <div className="flex items-center gap-x-2 rounded-md px-0.5 py-0.5 font-mono text-[13px] font-normal text-slate-600 dark:text-slate-300">
        <TaskStateIcon className="size-4" jobState={JobState.Discarded} />
        <span className="truncate">{depName}</span>
      </div>
    );
  }

  return (
    <Link
      className="flex items-center gap-x-2 rounded-md px-0.5 py-0.5 font-mono text-[13px] font-normal text-slate-600 hover:bg-slate-100/80 hover:text-brand-primary dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-blue-300"
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
    case "dependencies_and_wait_condition":
      return "Waiting on dependencies and wait condition";
    case "wait_condition":
      return "Waiting on wait condition";
    case "none":
    default:
      return "Not waiting";
  }
};

const getPendingStageLabel = (waitReason: WorkflowTaskWaitReason): string => {
  switch (waitReason) {
    case "none":
      return "Not yet staged";
    default:
      return "Not yet staged";
  }
};

type TaskTimelineEvent = {
  description?: ReactNode;
  icon: Heroicon;
  items?: TaskTimelineListItem[];
  key: string;
  metric?: ReactNode;
  status: "active" | "complete" | "failed" | "waiting";
  time: Date;
  title: string;
};

type TaskTimelineListItem = {
  label: string;
  mono?: boolean;
  selectedJobId?: bigint;
  state?: JobState;
  waitConditionKind?: string;
  waitConditionName?: string;
};

const TaskTimeline = ({
  job,
  jobsByTask,
  onSelectWaitCondition,
}: {
  job: WorkflowTask;
  jobsByTask: JobsByTask;
  onSelectWaitCondition: (conditionName: string) => void;
}) => {
  const events = useMemo(
    () => getTaskTimelineEvents(job, jobsByTask),
    [job, jobsByTask],
  );
  const [expandedEventKeys, setExpandedEventKeys] = useState<
    Record<string, boolean>
  >({});

  if (events.length === 0) return null;

  return (
    <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
      <Subheading className="mb-4 text-sm/6">Timeline</Subheading>

      <div className="flow-root">
        <ol className="-mb-5" role="list">
          {events.map((event, eventIdx) => {
            const toneClasses = getTaskTimelineToneClasses(event.status);
            const collapsibleItems = Boolean(
              event.items &&
              event.key !== "dependencies" &&
              event.key !== "wait-resolved" &&
              event.items.length > 3,
            );
            const expanded = expandedEventKeys[event.key] ?? false;
            const visibleItems = event.items
              ? collapsibleItems
                ? expanded
                  ? event.items
                  : event.items.slice(0, 3)
                : event.items
              : undefined;
            const hiddenItemCount =
              collapsibleItems && event.items
                ? Math.max(event.items.length - visibleItems!.length, 0)
                : 0;

            return (
              <li key={event.key}>
                <div className="relative pb-5">
                  {eventIdx !== events.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "absolute top-3.5 left-3.5 -ml-px h-full w-px",
                        toneClasses.line,
                      )}
                    />
                  ) : null}

                  <div
                    className={clsx(
                      "relative flex items-start gap-3 rounded-xl py-1",
                      toneClasses.row,
                    )}
                  >
                    <div>
                      <span
                        className={clsx(
                          "flex size-7 items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-900",
                          toneClasses.iconBackground,
                        )}
                      >
                        <event.icon
                          aria-hidden="true"
                          className={clsx("size-4", toneClasses.icon)}
                        />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {event.title}
                            </p>

                            {event.metric ? (
                              <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                                {event.metric}
                              </span>
                            ) : null}
                          </div>

                          {event.description ? (
                            <div className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                              {event.description}
                            </div>
                          ) : null}

                          {visibleItems && visibleItems.length > 0 ? (
                            <div className="mt-2">
                              <ul className="space-y-1.5">
                                {visibleItems.map((item) => {
                                  const waitConditionName =
                                    item.waitConditionName;

                                  return (
                                    <li
                                      className="text-sm text-slate-600 dark:text-slate-300"
                                      key={item.label}
                                    >
                                      {item.selectedJobId && item.state ? (
                                        <div className="-ml-0.5">
                                          <DependencyItem
                                            depJob={jobsByTask[item.label]}
                                            depName={item.label}
                                          />
                                        </div>
                                      ) : (
                                        <span className="flex items-center gap-2">
                                          {waitConditionName ? (
                                            <>
                                              <ConditionKindIcon
                                                className="shrink-0 text-slate-400 dark:text-slate-500"
                                                kind={
                                                  item.waitConditionKind ?? ""
                                                }
                                              />
                                              <button
                                                className={clsx(
                                                  "min-w-0 text-left break-all hover:text-brand-primary hover:underline",
                                                  item.mono &&
                                                    "font-mono text-[13px]",
                                                )}
                                                onClick={() =>
                                                  onSelectWaitCondition(
                                                    waitConditionName,
                                                  )
                                                }
                                                type="button"
                                              >
                                                {item.label}
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <span
                                                aria-hidden="true"
                                                className="block size-1.5 shrink-0 rounded-full bg-slate-400/80 dark:bg-slate-500"
                                              />
                                              <span
                                                className={clsx(
                                                  "min-w-0 break-all",
                                                  item.mono &&
                                                    "font-mono text-[13px]",
                                                )}
                                              >
                                                {item.label}
                                              </span>
                                            </>
                                          )}
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>

                              {hiddenItemCount > 0 ? (
                                <button
                                  className="mt-2 text-sm font-medium text-brand-primary hover:text-brand-primary/80"
                                  onClick={() => {
                                    setExpandedEventKeys((current) => ({
                                      ...current,
                                      [event.key]: true,
                                    }));
                                  }}
                                  type="button"
                                >
                                  Show {hiddenItemCount} more
                                </button>
                              ) : null}

                              {expanded && collapsibleItems ? (
                                <button
                                  className="mt-2 block text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                  onClick={() => {
                                    setExpandedEventKeys((current) => ({
                                      ...current,
                                      [event.key]: false,
                                    }));
                                  }}
                                  type="button"
                                >
                                  Show fewer
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="shrink-0 text-left whitespace-nowrap sm:text-right">
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            <RelativeTimeFormatter
                              addSuffix
                              time={event.time}
                            />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};

const getTaskTimelineToneClasses = (
  status: TaskTimelineEvent["status"],
): {
  icon: string;
  iconBackground: string;
  line: string;
  row: string;
} => {
  switch (status) {
    case "active":
      return {
        icon: "text-blue-700 dark:text-blue-200",
        iconBackground: "bg-blue-200 dark:bg-blue-700",
        line: "bg-slate-200 dark:bg-slate-700",
        row: "",
      };
    case "failed":
      return {
        icon: "text-red-700 dark:text-red-200",
        iconBackground: "bg-red-200 dark:bg-red-700",
        line: "bg-red-200 dark:bg-red-800",
        row: "",
      };
    case "waiting":
      return {
        icon: "text-amber-700 dark:text-amber-200",
        iconBackground: "bg-amber-200 dark:bg-amber-700",
        line: "bg-slate-200 dark:bg-slate-700",
        row: "",
      };
    case "complete":
    default:
      return {
        icon: "text-green-800 dark:text-green-200",
        iconBackground: "bg-green-300 dark:bg-green-700",
        line: "bg-green-300 dark:bg-green-800/80",
        row: "",
      };
  }
};

const getDependencyStateRank = (state: JobState | undefined): number => {
  switch (state) {
    case JobState.Available:
      return 1;
    case JobState.Cancelled:
      return 3;
    case JobState.Completed:
      return 2;
    case JobState.Discarded:
      return 4;
    case JobState.Pending:
    case JobState.Retryable:
      return 1;
    case JobState.Running:
      return 0;
    case JobState.Scheduled:
      return 1;
    default:
      return 5;
  }
};

const getDependencyTimelineTime = (
  job: undefined | WorkflowTask,
): Date | undefined => {
  return job?.finalizedAt ?? job?.attemptedAt ?? job?.createdAt;
};

const getTimelineDurationMetric = ({
  endTime,
  startTime,
}: {
  endTime?: Date;
  startTime: Date;
}): ReactNode => (
  <>
    (<DurationCompact endTime={endTime} startTime={startTime} />)
  </>
);

const getTaskTimelineEvents = (
  job: WorkflowTask,
  jobsByTask: JobsByTask,
): TaskTimelineEvent[] => {
  const events: TaskTimelineEvent[] = [];
  const dependencyItems = [...job.deps]
    .map((depName) => ({
      depJob: jobsByTask[depName],
      label: depName,
    }))
    .sort((leftDep, rightDep) => {
      const leftStateRank = getDependencyStateRank(leftDep.depJob?.state);
      const rightStateRank = getDependencyStateRank(rightDep.depJob?.state);

      if (leftStateRank !== rightStateRank) {
        return leftStateRank - rightStateRank;
      }

      return leftDep.label.localeCompare(rightDep.label);
    });

  if (dependencyItems.length > 0) {
    const finalizedDeps = dependencyItems.filter(
      (dep) => dep.depJob?.finalizedAt,
    );
    const latestDependencyTime =
      dependencyItems
        .map((dep) => getDependencyTimelineTime(dep.depJob))
        .filter((time): time is Date => Boolean(time))
        .sort(compareAsc)
        .at(-1) ?? job.createdAt;
    const dependenciesCleared = finalizedDeps.length === job.deps.length;

    events.push({
      description: getDependencyTimelineDescription({
        dependenciesCleared,
        finalizedDependencyCount: finalizedDeps.length,
        job,
      }),
      icon: LinkIcon,
      items: dependencyItems.map((dep) => ({
        label: dep.label,
        mono: true,
        selectedJobId: dep.depJob?.id,
        state: dep.depJob?.state,
      })),
      key: "dependencies",
      metric:
        compareAsc(latestDependencyTime, job.createdAt) > 0
          ? getTimelineDurationMetric({
              endTime: dependenciesCleared ? latestDependencyTime : undefined,
              startTime: job.createdAt,
            })
          : undefined,
      status: dependenciesCleared ? "complete" : "waiting",
      time: latestDependencyTime,
      title:
        finalizedDeps.length === 0
          ? job.deps.length === 1
            ? "Dependency pending"
            : "Dependencies pending"
          : finalizedDeps.length === job.deps.length
            ? "Dependencies completed"
            : "Dependencies progressing",
    });
  }

  if (job.wait?.phase === "waiting" && job.wait.startedAt) {
    events.push({
      description: getWaitPendingTimelineDescription(job.wait),
      icon: QueueListIcon,
      key: "wait-pending",
      metric: getTimelineDurationMetric({
        startTime: job.wait.startedAt,
      }),
      status: "waiting",
      time: job.wait.startedAt,
      title: "Waiting on wait condition",
    });
  }

  if (job.wait?.resolvedAt) {
    const matchedTerms = job.wait.terms.filter((term) => term.matched);

    events.push({
      description: getWaitResolvedTimelineDescription(job.wait),
      icon: CheckCircleIcon,
      items: matchedTerms.map((term) => ({
        label: term.name,
        mono: true,
        waitConditionKind: term.kind,
        waitConditionName: term.name,
      })),
      key: "wait-resolved",
      metric: job.wait.startedAt
        ? getTimelineDurationMetric({
            endTime: job.wait.resolvedAt,
            startTime: job.wait.startedAt,
          })
        : undefined,
      status: "complete",
      time: job.wait.resolvedAt,
      title: "Wait condition resolved",
    });
  }

  const stagedTime = getTaskTimelineStagedTime(job);
  if (stagedTime) {
    events.push({
      icon: QueueListIcon,
      key: "task-staged",
      metric:
        job.attemptedAt && compareAsc(job.attemptedAt, stagedTime) >= 0
          ? getTimelineDurationMetric({
              endTime: job.attemptedAt,
              startTime: stagedTime,
            })
          : undefined,
      status: job.attemptedAt ? "complete" : "waiting",
      time: stagedTime,
      title: "Wait",
    });
  }

  if (job.attemptedAt) {
    events.push({
      icon:
        job.state === JobState.Running ? RunningSpinnerIcon : PlayCircleIcon,
      key: "task-started",
      metric:
        job.state === JobState.Running
          ? getTimelineDurationMetric({
              startTime: job.attemptedAt,
            })
          : undefined,
      status: job.state === JobState.Running ? "active" : "complete",
      time: job.attemptedAt,
      title: "Task started",
    });
  }

  if (job.finalizedAt) {
    events.push({
      icon: getFinalizedTimelineIcon(job.state),
      key: "task-finalized",
      metric: job.attemptedAt
        ? getTimelineDurationMetric({
            endTime: job.finalizedAt,
            startTime: job.attemptedAt,
          })
        : undefined,
      status: getFinalizedTimelineStatus(job.state),
      time: job.finalizedAt,
      title: getFinalizedNarrativeLabel(job.state),
    });
  }

  return events.sort((leftEvent, rightEvent) =>
    compareAsc(leftEvent.time, rightEvent.time),
  );
};

const getTaskTimelineStagedTime = (job: WorkflowTask): Date | undefined => {
  if (job.state === JobState.Pending) return undefined;

  return job.stagedAt ?? job.createdAt;
};

const getDependencyTimelineDescription = ({
  dependenciesCleared,
  finalizedDependencyCount,
  job,
}: {
  dependenciesCleared: boolean;
  finalizedDependencyCount: number;
  job: WorkflowTask;
}): ReactNode => {
  const statusDescription =
    finalizedDependencyCount === 0
      ? `${job.deps.length} required dependency task${job.deps.length === 1 ? "" : "s"} pending.`
      : dependenciesCleared
        ? undefined
        : `${finalizedDependencyCount} of ${job.deps.length} required dependency tasks finished.`;

  const futureWaitDescription =
    job.wait?.phase === "not_started"
      ? getFutureWaitTimelinePreview(job.wait)
      : undefined;

  if (!statusDescription && !futureWaitDescription) {
    return undefined;
  }

  return (
    <>
      {statusDescription ? <p>{statusDescription}</p> : null}
      {futureWaitDescription ? (
        <p className="mt-1 text-amber-700 dark:text-amber-300">
          {futureWaitDescription}
        </p>
      ) : null}
    </>
  );
};

const getWaitResolvedTimelineDescription = (
  wait: NonNullable<WorkflowTask["wait"]>,
): ReactNode => {
  const matchedTerms = wait.terms.filter((term) => term.matched);

  if (matchedTerms.length > 1) {
    return `${matchedTerms.length} terms matched and the wait expression evaluated true.`;
  }

  if (wait.summary) {
    return `Resolved by ${trimTrailingPeriod(wait.summary)}.`;
  }

  if (matchedTerms.length === 1) {
    return `Resolved by ${trimTrailingPeriod(matchedTerms[0].label)}.`;
  }

  return "The wait condition no longer blocks this task.";
};

const getWaitPendingTimelineDescription = (
  wait: NonNullable<WorkflowTask["wait"]>,
): ReactNode => {
  if (wait.summary) {
    return `${trimTrailingPeriod(wait.summary)}.`;
  }

  return "This task is still blocked by its wait condition.";
};

const getFutureWaitTimelinePreview = (
  wait: NonNullable<WorkflowTask["wait"]>,
): ReactNode => {
  if (wait.summary) {
    return `Then ${trimTrailingPeriod(wait.summary).toLowerCase()}.`;
  }

  return "Then waits on the configured wait condition before staging.";
};

const trimTrailingPeriod = (value: string): string => value.replace(/\.+$/, "");

const getFinalizedTimelineIcon = (state: JobState): Heroicon => {
  switch (state) {
    case JobState.Cancelled:
      return XCircleIcon;
    case JobState.Discarded:
      return TrashIcon;
    case JobState.Completed:
    default:
      return CheckCircleIcon;
  }
};

const getFinalizedTimelineStatus = (
  state: JobState,
): TaskTimelineEvent["status"] => {
  switch (state) {
    case JobState.Cancelled:
    case JobState.Discarded:
      return "failed";
    case JobState.Completed:
    default:
      return "complete";
  }
};

const getFinalizedNarrativeLabel = (state: JobState): string => {
  switch (state) {
    case JobState.Cancelled:
      return "Task cancelled";
    case JobState.Completed:
      return "Task completed";
    case JobState.Discarded:
      return "Task discarded";
    default:
      return "Task finalized";
  }
};
