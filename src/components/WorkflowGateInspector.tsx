import { Badge } from "@components/Badge";
import { Subheading } from "@components/Heading";
import JSONView from "@components/JSONView";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import {
  BellAlertIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import {
  getWorkflowTaskSignals,
  type WorkflowTask,
  type WorkflowTaskSignal,
  type WorkflowTaskSignalList,
  type WorkflowTaskSignalReadScope,
  type WorkflowTaskWaitCondition,
  type WorkflowTaskWaitConditionTimer,
} from "@services/workflows";
import { formatDurationShort } from "@utils/time";
import clsx from "clsx";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import PlaintextPanel from "@/components/PlaintextPanel";

export type WaitConditionFocusRequest = {
  conditionName: string;
  requestID: number;
};

type WorkflowWaitConditionInspectorProps = {
  dependencyTasks?: Record<string, WorkflowTask>;
  focusRequest?: undefined | WaitConditionFocusRequest;
  onSelectCondition?: (conditionName: string) => void;
  taskName: string;
  wait: WorkflowTaskWaitCondition;
  workflowID: string;
};

export default function WorkflowWaitConditionInspector({
  dependencyTasks,
  focusRequest,
  onSelectCondition,
  taskName,
  wait,
  workflowID,
}: WorkflowWaitConditionInspectorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [closedFocusRequestID, setClosedFocusRequestID] = useState<number>();
  const [conditionFocusRequest, setConditionFocusRequest] =
    useState<WaitConditionFocusRequest>();
  const matchedConditions = useMemo(
    () =>
      buildWaitConditionConditions(wait, dependencyTasks).filter(
        (condition) => condition.matched,
      ),
    [dependencyTasks, wait],
  );
  const summaryConditions = useMemo(
    () => orderConditionsForSummary(wait.summary, matchedConditions),
    [matchedConditions, wait.summary],
  );
  const focusDetailsOpen =
    focusRequest !== undefined &&
    closedFocusRequestID !== focusRequest.requestID;
  const detailsVisible = detailsOpen || focusDetailsOpen;
  const activeFocusRequest = focusRequest ?? conditionFocusRequest;

  const handleSelectCondition = (conditionName: string) => {
    if (onSelectCondition) {
      onSelectCondition(conditionName);
      return;
    }

    setDetailsOpen(true);
    setConditionFocusRequest((current) => ({
      conditionName,
      requestID: (current?.requestID ?? 0) + 1,
    }));
  };

  const handleToggleDetails = () => {
    if (detailsVisible) {
      setDetailsOpen(false);
      setClosedFocusRequestID(focusRequest?.requestID);
      return;
    }

    setDetailsOpen(true);
    setClosedFocusRequestID(undefined);
  };

  return (
    <section className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Subheading className="text-sm/6">Wait condition</Subheading>
          <WaitConditionStatusPill wait={wait} />
        </div>
        <WaitConditionSummary
          matchedConditions={summaryConditions}
          onSelectCondition={handleSelectCondition}
          wait={wait}
        />
        <WaitConditionFacts wait={wait} />
        <button
          aria-expanded={detailsVisible}
          className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
          onClick={handleToggleDetails}
          type="button"
        >
          {detailsVisible ? (
            <ChevronDownIcon aria-hidden="true" className="size-4" />
          ) : (
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          )}
          Details
        </button>
      </div>

      {detailsVisible ? (
        <div className="mt-5 space-y-6">
          {hasWaitConditionDetails(wait) ? (
            <WaitConditionSection title="Conditions">
              <WaitConditionConditions
                dependencyTasks={dependencyTasks}
                focusRequest={activeFocusRequest}
                key={`${workflowID}:${taskName}:${wait.attempt?.toString() ?? ""}:${wait.phase}`}
                taskName={taskName}
                wait={wait}
                workflowID={workflowID}
              />
            </WaitConditionSection>
          ) : null}

          <WaitConditionSection title="Wait condition expression">
            <PlaintextPanel
              codeClassName="whitespace-pre-wrap break-all"
              content={wait.exprCel || "No CEL expression declared"}
              copyTitle="Wait condition expression"
              rawText={wait.exprCel || "No CEL expression declared"}
            />
          </WaitConditionSection>
        </div>
      ) : null}
    </section>
  );
}

const WaitConditionSummary = ({
  matchedConditions,
  onSelectCondition,
  wait,
}: {
  matchedConditions: WaitConditionCondition[];
  onSelectCondition: (conditionName: string) => void;
  wait: WorkflowTaskWaitCondition;
}) => {
  if (wait.phase === "resolved" && matchedConditions.length > 0) {
    return (
      <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
        Resolved by:{" "}
        <InlineConditionList
          conditions={matchedConditions}
          onSelectCondition={onSelectCondition}
        />
        .
      </p>
    );
  }

  return (
    <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
      {getWaitConditionSummary(wait)}
    </p>
  );
};

const InlineConditionList = ({
  conditions,
  onSelectCondition,
}: {
  conditions: WaitConditionCondition[];
  onSelectCondition: (conditionName: string) => void;
}) => {
  return (
    <>
      {conditions.map((condition, index) => (
        <span key={`${condition.kind}:${condition.technicalName}`}>
          {index > 0 ? ", " : null}
          <button
            className="text-brand-primary hover:text-blue-700 hover:underline dark:hover:text-blue-300"
            onClick={() => onSelectCondition(condition.technicalName)}
            type="button"
          >
            {condition.label}
          </button>
        </span>
      ))}
    </>
  );
};

export const WaitConditionStatusPill = ({
  wait,
}: {
  wait: WorkflowTaskWaitCondition;
}) => {
  const color =
    wait.phase === "resolved"
      ? "green"
      : wait.phase === "unknown"
        ? "zinc"
        : "amber";

  return (
    <Badge color={color} title={getWaitConditionStatusLabel(wait.phase)}>
      {getWaitConditionStatusLabel(wait.phase)}
    </Badge>
  );
};

const WaitConditionSection = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {title}
      </h4>
      {children}
    </div>
  );
};

const WaitConditionFacts = ({ wait }: { wait: WorkflowTaskWaitCondition }) => {
  const items = [
    wait.startedAt
      ? {
          label: "Started",
          value: <RelativeTimeFormatter addSuffix time={wait.startedAt} />,
        }
      : undefined,
    wait.resolvedAt
      ? {
          label: "Resolved",
          value: <RelativeTimeFormatter addSuffix time={wait.resolvedAt} />,
        }
      : undefined,
    wait.startedAt && wait.resolvedAt
      ? {
          label: "Waited",
          value: formatDurationShort(wait.resolvedAt, wait.startedAt, false),
        }
      : undefined,
    wait.asOf
      ? {
          label: "Evaluated",
          value: <RelativeTimeFormatter addSuffix time={wait.asOf} />,
        }
      : undefined,
    typeof wait.attempt === "number"
      ? {
          label: "Attempt",
          value: wait.attempt.toString(),
        }
      : undefined,
  ].filter((item) => item !== undefined);

  if (items.length === 0) return null;

  return (
    <dl className="grid max-w-4xl grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <div className="min-w-0" key={item.label}>
          <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {item.label}
          </dt>
          <dd className="mt-0.5 min-w-0 text-sm text-slate-600 dark:text-slate-300">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

type WaitConditionCondition = {
  dependencyTask?: WorkflowTask;
  kind: string;
  label: string;
  matched: boolean;
  signal?: WorkflowTaskWaitCondition["signals"][number];
  sortIndex: number;
  technicalName: string;
  timer?: WorkflowTaskWaitCondition["timers"][number];
};

const WaitConditionConditions = ({
  dependencyTasks,
  focusRequest,
  taskName,
  wait,
  workflowID,
}: {
  dependencyTasks: Record<string, WorkflowTask> | undefined;
  focusRequest: undefined | WaitConditionFocusRequest;
  taskName: string;
  wait: WorkflowTaskWaitCondition;
  workflowID: string;
}) => {
  const defaultScope = getDefaultTaskSignalScope(wait);
  const conditions = useMemo(
    () => buildWaitConditionConditions(wait, dependencyTasks),
    [dependencyTasks, wait],
  );
  const matchedConditions = conditions.filter((condition) => condition.matched);
  const latestConditionsRef = useRef(conditions);
  const conditionRowRefs = useRef(new Map<string, HTMLDivElement>());
  const handledFocusRequestIDRef = useRef<number>();
  const [expandedSignalKey, setExpandedSignalKey] = useState<string>();
  const [selectedScope, setSelectedScope] =
    useState<WorkflowTaskSignalReadScope>(defaultScope);
  const [signalListState, setSignalListState] = useState<SignalInspectorState>(
    emptySignalInspectorState,
  );

  useEffect(() => {
    if (!expandedSignalKey) return;

    const abortController = new AbortController();
    void getWorkflowTaskSignals({
      desc: true,
      key: expandedSignalKey,
      limit: 20,
      scope: selectedScope === "" ? undefined : selectedScope,
      signal: abortController.signal,
      taskName,
      workflowID,
    }).then(
      (signalList) => {
        if (abortController.signal.aborted) return;
        setSignalListState(signalInspectorStateFromSignalList(signalList));
      },
      () => {
        if (abortController.signal.aborted) return;
        setSignalListState({
          ...emptySignalInspectorState,
          error: "Unable to load signal history.",
        });
      },
    );

    return () => abortController.abort();
  }, [expandedSignalKey, selectedScope, taskName, workflowID]);

  useEffect(() => {
    latestConditionsRef.current = conditions;
  }, [conditions]);

  useEffect(() => {
    if (!focusRequest) return;
    if (handledFocusRequestIDRef.current === focusRequest.requestID) return;

    const focusedCondition = latestConditionsRef.current.find((condition) =>
      conditionMatchesName(condition, focusRequest.conditionName),
    );
    if (!focusedCondition) return;

    const row = conditionRowRefs.current.get(
      getConditionFocusKey(focusedCondition),
    );
    row?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    row?.focus({ preventScroll: true });
    handledFocusRequestIDRef.current = focusRequest.requestID;
  }, [focusRequest]);

  const registerConditionRow = (
    condition: WaitConditionCondition,
    node: HTMLDivElement | null,
  ) => {
    const key = getConditionFocusKey(condition);
    if (node) {
      conditionRowRefs.current.set(key, node);
      return;
    }

    conditionRowRefs.current.delete(key);
  };

  const handleToggleInspect = (signalKey: string) => {
    if (expandedSignalKey === signalKey) {
      setExpandedSignalKey(undefined);
      setSelectedScope(defaultScope);
      setSignalListState(emptySignalInspectorState);
      return;
    }

    setExpandedSignalKey(signalKey);
    setSelectedScope(defaultScope);
    setSignalListState({
      ...emptySignalInspectorState,
      isLoading: true,
    });
  };

  const handleLoadMore = async () => {
    if (
      !expandedSignalKey ||
      !signalListState.hasMore ||
      !signalListState.nextCursorID ||
      signalListState.isLoadingMore
    ) {
      return;
    }

    setSignalListState((current) => ({
      ...current,
      error: undefined,
      isLoadingMore: true,
    }));

    try {
      const nextPage = await getWorkflowTaskSignals({
        cursorID: signalListState.nextCursorID,
        desc: true,
        key: expandedSignalKey,
        limit: 20,
        scope: selectedScope === "" ? undefined : selectedScope,
        taskName,
        workflowID,
      });

      setSignalListState((current) => ({
        error: undefined,
        hasMore: nextPage.hasMore,
        isLoading: false,
        isLoadingMore: false,
        nextCursorID: nextPage.nextCursorID,
        scope: nextPage.scope,
        signals: [...current.signals, ...nextPage.signals],
      }));
    } catch {
      setSignalListState((current) => ({
        ...current,
        error: "Unable to load more signal history.",
        isLoadingMore: false,
      }));
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {matchedConditions.length.toString()} of {conditions.length.toString()}{" "}
        conditions matched
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="hidden gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 md:grid md:grid-cols-[5.75rem_minmax(0,1fr)_7rem] dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
          <span>Status</span>
          <span>Condition</span>
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {conditions.map((condition) => (
            <ConditionRow
              condition={condition}
              expandedSignalKey={expandedSignalKey}
              focused={Boolean(
                focusRequest &&
                conditionMatchesName(condition, focusRequest.conditionName),
              )}
              key={`${condition.kind}:${condition.technicalName}`}
              onLoadMore={handleLoadMore}
              onRegisterRow={registerConditionRow}
              onScopeChange={setSelectedScope}
              onToggleInspect={handleToggleInspect}
              selectedScope={selectedScope}
              signalListState={signalListState}
              wait={wait}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const ConditionRow = ({
  condition,
  expandedSignalKey,
  focused,
  onLoadMore,
  onRegisterRow,
  onScopeChange,
  onToggleInspect,
  selectedScope,
  signalListState,
  wait,
}: {
  condition: WaitConditionCondition;
  expandedSignalKey: string | undefined;
  focused: boolean;
  onLoadMore: () => void;
  onRegisterRow: (
    condition: WaitConditionCondition,
    node: HTMLDivElement | null,
  ) => void;
  onScopeChange: (scope: WorkflowTaskSignalReadScope) => void;
  onToggleInspect: (signalKey: string) => void;
  selectedScope: WorkflowTaskSignalReadScope;
  signalListState: SignalInspectorState;
  wait: WorkflowTaskWaitCondition;
}) => {
  const stateTone = getConditionStateTone(condition, wait.phase);
  const hasEvidence =
    condition.dependencyTask !== undefined ||
    condition.signal !== undefined ||
    condition.timer !== undefined;

  return (
    <div
      className={clsx(
        "scroll-mt-24 border-l-2 px-3 py-2.5 outline-none",
        stateTone.borderClassName,
        stateTone.rowClassName,
        focused && "ring-1 ring-brand-primary/40 ring-inset",
      )}
      data-testid="wait-condition-term-row"
      ref={(node) => onRegisterRow(condition, node)}
      tabIndex={-1}
    >
      <div className="grid gap-x-3 gap-y-1 md:grid-cols-[5.75rem_minmax(0,1fr)_7rem] md:items-start">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={clsx("size-2 rounded-full", stateTone.dotClassName)}
          />
          <span
            className={clsx(
              "text-xs leading-5 font-medium",
              stateTone.labelClassName,
            )}
          >
            {getConditionStateLabel(condition, wait.phase)}
          </span>
        </div>

        <div className="min-w-0">
          <div
            className={clsx(
              "text-sm font-medium",
              condition.matched
                ? "text-slate-900 dark:text-slate-100"
                : "text-slate-700 dark:text-slate-300",
            )}
          >
            {condition.label}
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            <ConditionKindLabel kind={condition.kind} />
            <span
              aria-hidden="true"
              className="size-1 rounded-full bg-slate-300 dark:bg-slate-600"
            />
            <span className="font-mono break-all">
              {condition.technicalName}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:justify-self-end">
          {condition.signal ? (
            <button
              className="text-sm font-medium text-brand-primary hover:text-blue-700 dark:hover:text-blue-300"
              onClick={() => onToggleInspect(condition.signal.key)}
              type="button"
            >
              {expandedSignalKey === condition.signal.key
                ? "Hide signals"
                : "View signals"}
            </button>
          ) : null}
        </div>

        {hasEvidence ? (
          <div className="min-w-0 md:col-span-2 md:col-start-2">
            <ConditionEvidence condition={condition} wait={wait} />
          </div>
        ) : null}
      </div>

      {condition.signal && expandedSignalKey === condition.signal.key ? (
        <SignalHistoryPanel
          canUseResolvedScope={wait.resolvedAt !== undefined}
          onLoadMore={onLoadMore}
          onScopeChange={onScopeChange}
          selectedScope={selectedScope}
          signalListState={signalListState}
        />
      ) : null}
    </div>
  );
};

const ConditionEvidence = ({
  condition,
  wait,
}: {
  condition: WaitConditionCondition;
  wait: WorkflowTaskWaitCondition;
}) => {
  if (condition.timer) {
    return <TimerConditionEvidence condition={condition} />;
  }

  if (condition.signal) {
    return <SignalConditionEvidence condition={condition} wait={wait} />;
  }

  if (condition.dependencyTask) {
    return <DependencyConditionEvidence condition={condition} wait={wait} />;
  }

  return null;
};

const TimerConditionEvidence = ({
  condition,
}: {
  condition: {
    timer: WorkflowTaskWaitCondition["timers"][number];
  } & WaitConditionCondition;
}) => {
  const anchor = condition.timer.anchor
    ? formatInlineTimerAnchor(condition.timer.anchor)
    : "immediate";

  return (
    <p className="min-w-0 text-xs leading-5 text-slate-600 dark:text-slate-300">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {condition.timer.fired || condition.timer.matched ? "Fired" : "Fires"}
      </span>{" "}
      <TimerTiming timer={condition.timer} />
      <span className="text-slate-400 dark:text-slate-500">, </span>
      delay {getTimerDelayLabel(condition.timer) ?? "none"}
      <span className="text-slate-400 dark:text-slate-500">, </span>
      anchor {anchor}
    </p>
  );
};

const DependencyConditionEvidence = ({
  condition,
  wait,
}: {
  condition: {
    dependencyTask: WorkflowTask;
  } & WaitConditionCondition;
  wait: WorkflowTaskWaitCondition;
}) => {
  if (condition.dependencyTask.finalizedAt) {
    return (
      <p className="min-w-0 text-xs leading-5 text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Finalized
        </span>{" "}
        <RelativeTimeFormatter
          addSuffix
          time={condition.dependencyTask.finalizedAt}
        />
      </p>
    );
  }

  return condition.matched ? (
    <ConditionSnapshotTiming
      label="Matched"
      resolvedLabel="by resolution"
      wait={wait}
    />
  ) : null;
};

const SignalConditionEvidence = ({
  condition,
  wait,
}: {
  condition: {
    signal: WorkflowTaskWaitCondition["signals"][number];
  } & WaitConditionCondition;
  wait: WorkflowTaskWaitCondition;
}) => {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
      <dl className="contents">
        <CompactEvidenceField label="Key" value={condition.signal.key} />
        <CompactEvidenceField
          label="Visible"
          value={condition.signal.visibleCount.toString()}
        />
        <CompactEvidenceField
          label="Matched"
          value={condition.signal.matchedCount.toString()}
        />
        {condition.signal.lastVisibleID ? (
          <CompactEvidenceField
            label="Last visible"
            value={`#${condition.signal.lastVisibleID.toString()}`}
          />
        ) : null}
        {condition.signal.lastMatchedID ? (
          <CompactEvidenceField
            label="Last matched"
            value={`#${condition.signal.lastMatchedID.toString()}`}
          />
        ) : null}
      </dl>
      {condition.matched ? (
        <ConditionSnapshotTiming
          label="Matched"
          resolvedLabel="by resolution"
          wait={wait}
        />
      ) : null}
    </div>
  );
};

const ConditionSnapshotTiming = ({
  label,
  resolvedLabel,
  wait,
}: {
  label: string;
  resolvedLabel: string;
  wait: WorkflowTaskWaitCondition;
}) => {
  const time = wait.resolvedAt ?? wait.asOf;
  if (!time) return null;

  return (
    <span className="min-w-0">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>{" "}
      {wait.resolvedAt ? resolvedLabel : "by evaluation"}{" "}
      <RelativeTimeFormatter addSuffix time={time} />
    </span>
  );
};

const CompactEvidenceField = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 font-mono break-all text-slate-800 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
};

const ConditionKindLabel = ({ kind }: { kind: string }) => {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <ConditionKindIcon kind={kind} />
      <span className="truncate">{getWaitConditionTermKindLabel(kind)}</span>
    </span>
  );
};

export const ConditionKindIcon = ({
  className,
  kind,
}: {
  className?: string;
  kind: string;
}) => {
  switch (kind) {
    case "dependency_output":
      return (
        <LinkIcon aria-hidden="true" className={clsx("size-3.5", className)} />
      );
    case "signal":
      return (
        <BellAlertIcon
          aria-hidden="true"
          className={clsx("size-3.5", className)}
        />
      );
    case "timer":
      return (
        <ClockIcon aria-hidden="true" className={clsx("size-3.5", className)} />
      );
    default:
      return null;
  }
};

const TimerTiming = ({
  timer,
}: {
  timer: WorkflowTaskWaitCondition["timers"][number];
}) => {
  if (!timer.fireAt) {
    return <span>when anchor is available</span>;
  }

  return <RelativeTimeFormatter addSuffix time={timer.fireAt} />;
};

type SignalInspectorState = {
  error?: string;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  nextCursorID?: bigint;
  scope?: WorkflowTaskSignalList["scope"];
  signals: WorkflowTaskSignal[];
};

const emptySignalInspectorState: SignalInspectorState = {
  hasMore: false,
  isLoading: false,
  isLoadingMore: false,
  signals: [],
};

const hasWaitConditionDetails = (wait: WorkflowTaskWaitCondition): boolean => {
  return (
    wait.terms.length > 0 || wait.signals.length > 0 || wait.timers.length > 0
  );
};

const buildWaitConditionConditions = (
  wait: WorkflowTaskWaitCondition,
  dependencyTasks?: Record<string, WorkflowTask>,
): WaitConditionCondition[] => {
  const usedSignalKeys = new Set<string>();
  const usedTimerNames = new Set<string>();
  const conditions: WaitConditionCondition[] = wait.terms.map((term, index) => {
    const signal = findSignalForTerm(term.name, wait.signals);
    const timer = findTimerForTerm(term.name, wait.timers);
    const dependencyTask =
      term.kind === "dependency_output"
        ? findDependencyTaskForTerm(term.name, dependencyTasks)
        : undefined;

    if (signal) {
      usedSignalKeys.add(signal.key);
    }
    if (timer) {
      usedTimerNames.add(timer.name);
    }

    return {
      dependencyTask,
      kind: term.kind,
      label: getWaitConditionTermDisplayLabel(term),
      matched: term.matched,
      signal,
      sortIndex: index,
      technicalName: term.name,
      timer,
    };
  });

  wait.signals.forEach((signal, index) => {
    if (usedSignalKeys.has(signal.key)) return;

    conditions.push({
      kind: "signal",
      label: signal.key,
      matched: signal.matched,
      signal,
      sortIndex: wait.terms.length + index,
      technicalName: signal.key,
    });
  });

  wait.timers.forEach((timer, index) => {
    if (usedTimerNames.has(timer.name)) return;

    conditions.push({
      kind: "timer",
      label: humanizeIdentifier(timer.name),
      matched: timer.matched,
      sortIndex: wait.terms.length + wait.signals.length + index,
      technicalName: timer.name,
      timer,
    });
  });

  return conditions.sort((leftCondition, rightCondition) =>
    compareConditions(leftCondition, rightCondition, wait.phase),
  );
};

const findDependencyTaskForTerm = (
  termName: string,
  dependencyTasks: Record<string, WorkflowTask> | undefined,
): undefined | WorkflowTask => {
  if (!dependencyTasks) return undefined;

  const normalizedTermName = normalizeConditionName(termName);
  const candidates = Object.values(dependencyTasks)
    .filter((task) => {
      const normalizedTaskName = normalizeConditionName(task.name);
      return (
        normalizedTermName === normalizedTaskName ||
        normalizedTermName.startsWith(`${normalizedTaskName}_`)
      );
    })
    .sort(
      (leftTask, rightTask) => rightTask.name.length - leftTask.name.length,
    );

  return candidates[0];
};

const findSignalForTerm = (
  termName: string,
  signals: WorkflowTaskWaitCondition["signals"],
) => {
  const normalizedTermName = normalizeConditionName(termName);

  return signals.find((signal) => {
    const normalizedSignalKey = normalizeConditionName(signal.key);
    return (
      normalizedTermName === normalizedSignalKey ||
      normalizedTermName.startsWith(`${normalizedSignalKey}_`) ||
      normalizedSignalKey.startsWith(`${normalizedTermName}_`)
    );
  });
};

const findTimerForTerm = (
  termName: string,
  timers: WorkflowTaskWaitCondition["timers"],
) => {
  const normalizedTermName = normalizeConditionName(termName);

  return timers.find((timer) => {
    const normalizedTimerName = normalizeConditionName(timer.name);
    return (
      normalizedTermName === normalizedTimerName ||
      normalizedTermName.startsWith(`${normalizedTimerName}_`) ||
      normalizedTimerName.startsWith(`${normalizedTermName}_`)
    );
  });
};

const compareConditions = (
  leftCondition: WaitConditionCondition,
  rightCondition: WaitConditionCondition,
  phase: WorkflowTaskWaitCondition["phase"],
): number => {
  const leftRank = getConditionSortRank(leftCondition, phase);
  const rightRank = getConditionSortRank(rightCondition, phase);

  if (leftRank !== rightRank) return leftRank - rightRank;

  const leftFireAt = leftCondition.timer?.fireAt?.getTime();
  const rightFireAt = rightCondition.timer?.fireAt?.getTime();
  if (leftFireAt !== undefined && rightFireAt !== undefined) {
    return leftFireAt - rightFireAt;
  }
  if (leftFireAt !== undefined) return -1;
  if (rightFireAt !== undefined) return 1;

  return leftCondition.sortIndex - rightCondition.sortIndex;
};

const getConditionSortRank = (
  condition: WaitConditionCondition,
  phase: WorkflowTaskWaitCondition["phase"],
): number => {
  if (condition.matched) return 0;

  if (phase === "resolved") return 1;
  if (condition.timer?.fireAt) return 1;
  if (condition.timer) return 2;
  if (condition.signal) return 3;

  return 4;
};

const getConditionStateLabel = (
  condition: WaitConditionCondition,
  phase: WorkflowTaskWaitCondition["phase"],
): string => {
  if (condition.matched) return "Matched";
  if (condition.timer?.fired) return "Fired";
  if (phase === "not_started") {
    return condition.timer?.fireAt ? "Scheduled" : "Pending";
  }
  if (phase !== "resolved") {
    return condition.timer?.fireAt ? "Scheduled" : "Waiting";
  }

  return "Not matched";
};

const getConditionStateTone = (
  condition: WaitConditionCondition,
  phase: WorkflowTaskWaitCondition["phase"],
): {
  borderClassName: string;
  dotClassName: string;
  labelClassName: string;
  rowClassName: string;
} => {
  if (condition.matched) {
    return {
      borderClassName: "border-l-green-400",
      dotClassName: "bg-green-500",
      labelClassName: "text-green-700 dark:text-green-400",
      rowClassName: "bg-green-50/30 dark:bg-green-950/10",
    };
  }

  if (condition.timer?.fired) {
    return {
      borderClassName: "border-l-amber-400",
      dotClassName: "bg-amber-500",
      labelClassName: "text-amber-700 dark:text-amber-400",
      rowClassName: "bg-amber-50/30 dark:bg-amber-950/10",
    };
  }

  if (phase !== "resolved" && condition.timer?.fireAt) {
    return {
      borderClassName: "border-l-blue-400",
      dotClassName: "bg-blue-500",
      labelClassName: "text-blue-700 dark:text-blue-400",
      rowClassName: "bg-blue-50/30 dark:bg-blue-950/10",
    };
  }

  if (phase === "waiting") {
    return {
      borderClassName: "border-l-amber-300",
      dotClassName: "bg-amber-400",
      labelClassName: "text-amber-700 dark:text-amber-400",
      rowClassName: "bg-amber-50/20 dark:bg-amber-950/10",
    };
  }

  return {
    borderClassName: "border-l-slate-200 dark:border-l-slate-700",
    dotClassName: "bg-slate-300 dark:bg-slate-600",
    labelClassName: "text-slate-500 dark:text-slate-400",
    rowClassName: "bg-white dark:bg-slate-950/20",
  };
};

const getConditionFocusKey = (condition: WaitConditionCondition): string => {
  return `${condition.kind}:${condition.technicalName}`;
};

const conditionMatchesName = (
  condition: WaitConditionCondition,
  conditionName: string,
): boolean => {
  const normalizedConditionName = normalizeConditionName(conditionName);
  const possibleNames = [
    condition.technicalName,
    condition.label,
    condition.signal?.key,
    condition.timer?.name,
  ].filter((name): name is string => Boolean(name));

  return possibleNames.some(
    (possibleName) =>
      normalizeConditionName(possibleName) === normalizedConditionName,
  );
};

const orderConditionsForSummary = (
  summary: string | undefined,
  conditions: WaitConditionCondition[],
): WaitConditionCondition[] => {
  if (!summary) return conditions;

  const normalizedSummary = summary.toLowerCase();

  return [...conditions].sort((leftCondition, rightCondition) => {
    const leftIndex = normalizedSummary.indexOf(
      leftCondition.label.toLowerCase(),
    );
    const rightIndex = normalizedSummary.indexOf(
      rightCondition.label.toLowerCase(),
    );

    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1;
    if (rightIndex >= 0) return 1;

    return 0;
  });
};

const SignalHistoryPanel = ({
  canUseResolvedScope,
  onLoadMore,
  onScopeChange,
  selectedScope,
  signalListState,
}: {
  canUseResolvedScope: boolean;
  onLoadMore: () => void;
  onScopeChange: (scope: WorkflowTaskSignalReadScope) => void;
  selectedScope: WorkflowTaskSignalReadScope;
  signalListState: SignalInspectorState;
}) => {
  return (
    <div className="mt-2 border-t border-slate-200 py-3 dark:border-slate-800">
      <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        {canUseResolvedScope ? (
          <ScopeButton
            active={selectedScope === "at_wait_condition_resolved"}
            label="At wait condition resolved"
            onClick={() => onScopeChange("at_wait_condition_resolved")}
          />
        ) : null}
        <ScopeButton
          active={selectedScope === "current_attempt"}
          label="Current attempt"
          onClick={() => onScopeChange("current_attempt")}
        />
      </div>

      {signalListState.scope ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {getTaskSignalsScopeBanner(signalListState.scope)}
        </p>
      ) : null}

      {signalListState.error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {signalListState.error}
        </p>
      ) : null}

      {signalListState.isLoading ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Loading signal history…
        </p>
      ) : null}

      {!signalListState.isLoading && signalListState.signals.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          No signals found for this scope.
        </p>
      ) : null}

      <div className="mt-3 space-y-3">
        {signalListState.signals.map((signal) => (
          <div
            className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40"
            key={signal.id.toString()}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge color="light">#{signal.id.toString()}</Badge>
              <span className="font-mono break-all text-slate-900 dark:text-slate-100">
                {signal.key}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                attempt {signal.attempt.toString()}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                <RelativeTimeFormatter addSuffix time={signal.createdAt} />
              </span>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <SignalPayloadPanel
                copyTitle="Signal payload"
                data={signal.payload}
              />
              <SignalPayloadPanel
                copyTitle="Signal source"
                data={signal.source}
              />
            </div>
          </div>
        ))}
      </div>

      {signalListState.hasMore ? (
        <button
          className="mt-3 text-sm font-medium text-brand-primary hover:text-blue-700 dark:hover:text-blue-300"
          onClick={onLoadMore}
          type="button"
        >
          {signalListState.isLoadingMore ? "Loading more…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
};

const SignalPayloadPanel = ({
  copyTitle,
  data,
}: {
  copyTitle: string;
  data: unknown;
}) => {
  return <JSONView copyTitle={copyTitle} data={data} defaultExpandDepth={1} />;
};

const ScopeButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => {
  return (
    <button
      className={clsx(
        "border-r border-slate-200 px-3 py-1.5 text-xs font-medium last:border-r-0 dark:border-slate-700",
        active
          ? "bg-brand-primary/10 text-brand-primary"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
};

const signalInspectorStateFromSignalList = (
  signalList: WorkflowTaskSignalList,
): SignalInspectorState => ({
  error: undefined,
  hasMore: signalList.hasMore,
  isLoading: false,
  isLoadingMore: false,
  nextCursorID: signalList.nextCursorID,
  scope: signalList.scope,
  signals: signalList.signals,
});

const getDefaultTaskSignalScope = (
  wait: WorkflowTaskWaitCondition,
): WorkflowTaskSignalReadScope =>
  wait.resolvedAt !== undefined
    ? "at_wait_condition_resolved"
    : "current_attempt";

const getTaskSignalsScopeBanner = (
  scope: WorkflowTaskSignalList["scope"],
): string => {
  switch (scope.scope) {
    case "at_wait_condition_resolved":
      return `Showing signals visible when the wait condition resolved for attempt ${scope.attempt.toString()}.`;
    case "current_attempt":
      return `Showing signals from the current visible rows for attempt ${scope.attempt.toString()}.`;
    default:
      return `Showing task-visible signals for attempt ${scope.attempt.toString()}.`;
  }
};

const getWaitConditionStatusLabel = (
  phase: WorkflowTaskWaitCondition["phase"],
): string => {
  switch (phase) {
    case "not_started":
      return "Not started";
    case "resolved":
      return "Resolved";
    case "waiting":
      return "Waiting";
    default:
      return "Unknown";
  }
};

const getWaitConditionSummary = (wait: WorkflowTaskWaitCondition): string => {
  if (wait.summary) {
    return wait.phase === "resolved"
      ? `Resolved by: ${wait.summary}.`
      : wait.summary;
  }

  switch (wait.phase) {
    case "not_started":
      return "Wait condition has not started because dependencies are still incomplete.";
    case "resolved":
      return "Wait condition resolved.";
    case "waiting":
      return "This task is waiting for its wait condition.";
    default:
      return "Wait condition state is unavailable.";
  }
};

const getWaitConditionTermKindLabel = (kind: string): string => {
  switch (kind) {
    case "dependency_output":
      return "Dependency";
    case "signal":
      return "Signal";
    case "timer":
      return "Timer";
    default:
      return kind.replaceAll("_", " ");
  }
};

const getWaitConditionTermLabel = (
  term: WorkflowTaskWaitCondition["terms"][number],
): string => {
  if (!term.label || term.label === term.name) {
    return "—";
  }

  return term.label;
};

const getWaitConditionTermDisplayLabel = (
  term: WorkflowTaskWaitCondition["terms"][number],
): string => {
  const label = getWaitConditionTermLabel(term);
  return label === "—" ? humanizeIdentifier(term.name) : label;
};

const normalizeConditionName = (value: string): string => {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
};

const humanizeIdentifier = (value: string): string => {
  return normalizeConditionName(value).replaceAll("_", " ");
};

const formatTimerAnchor = (
  anchor: NonNullable<WorkflowTaskWaitConditionTimer["anchor"]>,
): string => {
  switch (anchor.kind) {
    case "task_finalized_at":
      return anchor.task
        ? `After ${anchor.task} finalized`
        : "After dependency finalized";
    case "wait_started_at":
      return "Wait started";
    case "workflow_created_at":
      return "After workflow created";
    default:
      return anchor.task
        ? `${anchor.kind.replaceAll("_", " ")} (${anchor.task})`
        : anchor.kind.replaceAll("_", " ");
  }
};

const formatInlineTimerAnchor = (
  anchor: NonNullable<WorkflowTaskWaitConditionTimer["anchor"]>,
): string => {
  const label = formatTimerAnchor(anchor);
  return `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
};

const getTimerDelayLabel = (
  timer: WorkflowTaskWaitCondition["timers"][number],
): string | undefined => {
  if (typeof timer.afterSeconds !== "number") return undefined;

  if (Number.isInteger(timer.afterSeconds)) {
    if (timer.afterSeconds % 3600 === 0) {
      return `+${(timer.afterSeconds / 3600).toString()}h`;
    }
    if (timer.afterSeconds % 60 === 0) {
      return `+${(timer.afterSeconds / 60).toString()}m`;
    }
  }

  return `+${formatDurationShort(new Date(timer.afterSeconds * 1000), new Date(0), false)}`;
};
