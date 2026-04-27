import { Badge } from "@components/Badge";
import { Subheading } from "@components/Heading";
import JSONView from "@components/JSONView";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  InboxIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import {
  getWorkflowTaskSignals,
  getWorkflowTaskWaitDiagnostics,
  type WorkflowTask,
  type WorkflowTaskSignal,
  type WorkflowTaskSignalList,
  type WorkflowTaskSignalListScope,
  type WorkflowTaskWait,
  type WorkflowTaskWaitDiagnostics,
  type WorkflowTaskWaitTimer,
} from "@services/workflows";
import { formatDurationShort } from "@utils/time";
import clsx from "clsx";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import PlaintextPanel from "@/components/PlaintextPanel";

export type TaskSignalLoader = typeof getWorkflowTaskSignals;
export type TaskWaitDiagnosticsLoader = typeof getWorkflowTaskWaitDiagnostics;

export type WaitFocusRequest = {
  conditionName: string;
  requestID: number;
};

type WorkflowWaitInspectorProps = {
  dependencyTasks?: Record<string, WorkflowTask>;
  focusRequest?: undefined | WaitFocusRequest;
  loadTaskSignals?: TaskSignalLoader;
  loadTaskWaitDiagnostics?: TaskWaitDiagnosticsLoader;
  onSelectCondition?: (conditionName: string) => void;
  taskName: string;
  wait: WorkflowTaskWait;
  workflowID: string;
};

export default function WorkflowWaitInspector({
  dependencyTasks,
  focusRequest,
  loadTaskSignals = getWorkflowTaskSignals,
  loadTaskWaitDiagnostics = getWorkflowTaskWaitDiagnostics,
  onSelectCondition,
  taskName,
  wait,
  workflowID,
}: WorkflowWaitInspectorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [closedFocusRequestID, setClosedFocusRequestID] = useState<number>();
  const [conditionFocusRequest, setConditionFocusRequest] =
    useState<WaitFocusRequest>();
  const [diagnosticsState, setDiagnosticsState] =
    useState<WaitDiagnosticsState>(emptyWaitDiagnosticsState);
  const conditions = useMemo(
    () => buildWaitTermViews(wait, dependencyTasks, diagnosticsState.value),
    [dependencyTasks, diagnosticsState.value, wait],
  );
  const matchedConditions = useMemo(
    () => conditions.filter((condition) => condition.matched),
    [conditions],
  );
  const summaryConditions = useMemo(
    () => orderConditionsForSummary(wait.summary, matchedConditions),
    [matchedConditions, wait.summary],
  );
  const conditionSignalScope = getConditionSignalScope(wait);
  const allTaskSignalsScope = getAllTaskSignalsScope();
  const hasSignals = wait.inputs.signals.length > 0;
  const signalHistoryKey = `${workflowID}:${taskName}:${wait.evidence?.workflowAttempt.toString() ?? ""}:${wait.phase}`;
  const autoOpenSignalSurfaceCandidate = useMemo(
    () => getAutoOpenSignalEvidenceSurface(conditions),
    [conditions],
  );
  const focusDetailsOpen =
    focusRequest !== undefined &&
    closedFocusRequestID !== focusRequest.requestID;
  const detailsVisible = detailsOpen || focusDetailsOpen;
  const activeFocusRequest = focusRequest ?? conditionFocusRequest;
  const [openSignalSurfaceContextKey, setOpenSignalSurfaceContextKey] =
    useState<string>();
  const [openSignalSurface, setOpenSignalSurface] =
    useState<SignalHistorySurface>();
  const [dismissedAutoOpenSignalKey, setDismissedAutoOpenSignalKey] =
    useState<string>();
  const [conditionSignalStates, setConditionSignalStates] = useState<
    Record<string, SignalInspectorState>
  >({});
  const [allSignalListState, setAllSignalListState] =
    useState<SignalInspectorState>(emptySignalInspectorState);
  const storedOpenSignalSurface =
    openSignalSurfaceContextKey === signalHistoryKey
      ? openSignalSurface
      : undefined;
  const autoOpenSignalSurface = useMemo<
    SignalHistorySurface | undefined
  >(() => {
    if (
      !detailsVisible ||
      !autoOpenSignalSurfaceCandidate ||
      dismissedAutoOpenSignalKey ===
        getSignalSurfaceStateKey(autoOpenSignalSurfaceCandidate) ||
      openSignalSurfaceContextKey === signalHistoryKey
    ) {
      return undefined;
    }

    return autoOpenSignalSurfaceCandidate;
  }, [
    autoOpenSignalSurfaceCandidate,
    detailsVisible,
    dismissedAutoOpenSignalKey,
    openSignalSurfaceContextKey,
    signalHistoryKey,
  ]);
  const currentOpenSignalSurface =
    storedOpenSignalSurface ?? autoOpenSignalSurface;
  const currentAllSignalListState =
    openSignalSurfaceContextKey === signalHistoryKey
      ? allSignalListState
      : emptySignalInspectorState;

  useEffect(() => {
    if (!detailsVisible || wait.phase === "resolved") return;

    const abortController = new AbortController();
    queueMicrotask(() => {
      if (abortController.signal.aborted) return;
      setDiagnosticsState({ isLoading: true });
    });
    void loadTaskWaitDiagnostics({
      signal: abortController.signal,
      taskName,
      workflowID,
    }).then(
      (diagnostics) => {
        if (abortController.signal.aborted) return;
        setDiagnosticsState({ isLoading: false, value: diagnostics });
      },
      (error) => {
        if (abortController.signal.aborted) return;
        setDiagnosticsState({
          error: waitDiagnosticsErrorMessage(error),
          isLoading: false,
        });
      },
    );

    return () => abortController.abort();
  }, [
    detailsVisible,
    loadTaskWaitDiagnostics,
    taskName,
    wait.phase,
    workflowID,
  ]);

  useEffect(() => {
    if (!currentOpenSignalSurface) return;

    const abortController = new AbortController();
    const signalKey = getSignalSurfaceKey(currentOpenSignalSurface);
    const termName = getSignalSurfaceTermName(currentOpenSignalSurface);
    const scope =
      currentOpenSignalSurface.kind === "condition"
        ? conditionSignalScope
        : allTaskSignalsScope;

    void loadTaskSignals({
      desc: true,
      key: signalKey,
      limit: 20,
      scope,
      signal: abortController.signal,
      taskName,
      termName,
      workflowID,
    }).then(
      (signalList) => {
        if (abortController.signal.aborted) return;
        const nextState = signalInspectorStateFromSignalList(signalList);
        if (currentOpenSignalSurface.kind === "condition") {
          setConditionSignalStates((current) => ({
            ...current,
            [getSignalSurfaceStateKey(currentOpenSignalSurface)]: nextState,
          }));
          return;
        }

        setAllSignalListState(nextState);
      },
      () => {
        if (abortController.signal.aborted) return;
        const nextState = {
          ...emptySignalInspectorState,
          error: "Unable to load signal history.",
        };
        if (currentOpenSignalSurface.kind === "condition") {
          setConditionSignalStates((current) => ({
            ...current,
            [getSignalSurfaceStateKey(currentOpenSignalSurface)]: nextState,
          }));
          return;
        }

        setAllSignalListState(nextState);
      },
    );

    return () => abortController.abort();
  }, [
    allTaskSignalsScope,
    conditionSignalScope,
    currentOpenSignalSurface,
    loadTaskSignals,
    taskName,
    workflowID,
  ]);

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

  const handleToggleConditionSignals = (surface: SignalHistorySurface) => {
    if (surface.kind !== "condition") return;
    const stateKey = getSignalSurfaceStateKey(surface);
    if (
      currentOpenSignalSurface?.kind === "condition" &&
      getSignalSurfaceStateKey(currentOpenSignalSurface) === stateKey
    ) {
      setOpenSignalSurface(undefined);
      setDismissedAutoOpenSignalKey(stateKey);
      return;
    }

    setOpenSignalSurfaceContextKey(signalHistoryKey);
    setOpenSignalSurface(surface);
    setConditionSignalStates((current) => ({
      ...current,
      [stateKey]: {
        ...emptySignalInspectorState,
        isLoading: true,
      },
    }));
  };

  const handleToggleAllTaskSignals = () => {
    if (currentOpenSignalSurface?.kind === "all") {
      setOpenSignalSurface(undefined);
      return;
    }

    setOpenSignalSurfaceContextKey(signalHistoryKey);
    setOpenSignalSurface({ kind: "all" });
    setAllSignalListState({
      ...emptySignalInspectorState,
      isLoading: true,
    });
  };

  const handleLoadMoreSignals = async (surface: SignalHistorySurface) => {
    const currentState =
      surface.kind === "condition"
        ? (conditionSignalStates[getSignalSurfaceStateKey(surface)] ??
          emptySignalInspectorState)
        : currentAllSignalListState;

    if (
      !currentState.hasMore ||
      !currentState.nextCursorID ||
      currentState.isLoadingMore
    ) {
      return;
    }

    if (surface.kind === "condition") {
      const stateKey = getSignalSurfaceStateKey(surface);
      setConditionSignalStates((current) => ({
        ...current,
        [stateKey]: {
          ...(current[stateKey] ?? emptySignalInspectorState),
          error: undefined,
          isLoadingMore: true,
        },
      }));
    } else {
      setAllSignalListState((current) => ({
        ...current,
        error: undefined,
        isLoadingMore: true,
      }));
    }

    try {
      const nextPage = await loadTaskSignals({
        cursorID: currentState.nextCursorID,
        desc: true,
        key: getSignalSurfaceKey(surface),
        limit: 20,
        scope:
          surface.kind === "condition"
            ? conditionSignalScope
            : allTaskSignalsScope,
        taskName,
        termName: getSignalSurfaceTermName(surface),
        workflowID,
      });

      const buildNextState = (current: SignalInspectorState) => ({
        error: undefined,
        hasMore: nextPage.hasMore,
        isLoading: false,
        isLoadingMore: false,
        nextCursorID: nextPage.nextCursorID,
        scope: nextPage.scope,
        signals: [...current.signals, ...nextPage.signals],
      });

      if (surface.kind === "condition") {
        const stateKey = getSignalSurfaceStateKey(surface);
        setConditionSignalStates((current) => ({
          ...current,
          [stateKey]: buildNextState(
            current[stateKey] ?? emptySignalInspectorState,
          ),
        }));
      } else {
        setAllSignalListState(buildNextState);
      }
    } catch {
      if (surface.kind === "condition") {
        const stateKey = getSignalSurfaceStateKey(surface);
        setConditionSignalStates((current) => ({
          ...current,
          [stateKey]: {
            ...(current[stateKey] ?? emptySignalInspectorState),
            error: "Unable to load more signal history.",
            isLoadingMore: false,
          },
        }));
      } else {
        setAllSignalListState((current) => ({
          ...current,
          error: "Unable to load more signal history.",
          isLoadingMore: false,
        }));
      }
    }
  };

  return (
    <section className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Subheading className="text-sm/6">Wait condition</Subheading>
          <WaitStatusPill wait={wait} />
        </div>
        <WaitSummary
          matchedConditions={summaryConditions}
          onSelectCondition={handleSelectCondition}
          wait={wait}
        />
        <WaitFacts wait={wait} />
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
          {hasWaitDetails(wait) ? (
            <WaitSection title="Conditions">
              <WaitTermViews
                conditions={conditions}
                focusRequest={activeFocusRequest}
                key={`${workflowID}:${taskName}:${wait.evidence?.workflowAttempt.toString() ?? ""}:${wait.phase}`}
                onLoadMore={handleLoadMoreSignals}
                onToggleConditionSignals={handleToggleConditionSignals}
                openSignalSurface={currentOpenSignalSurface}
                signalListStates={conditionSignalStates}
                wait={wait}
              />
            </WaitSection>
          ) : null}

          {wait.phase !== "resolved" ? (
            <WaitDiagnosticsPanel diagnosticsState={diagnosticsState} />
          ) : null}

          <WaitSection title="Wait expression">
            <PlaintextPanel
              codeClassName="whitespace-pre-wrap break-all"
              content={wait.exprCel || "No CEL expression declared"}
              copyTitle="Wait expression"
              rawText={wait.exprCel || "No CEL expression declared"}
            />
          </WaitSection>
        </div>
      ) : null}

      {hasSignals ? (
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <AllTaskSignalsPanel
            onLoadMore={handleLoadMoreSignals}
            onToggle={handleToggleAllTaskSignals}
            open={currentOpenSignalSurface?.kind === "all"}
            signalListState={currentAllSignalListState}
          />
        </div>
      ) : null}
    </section>
  );
}

const WaitSummary = ({
  matchedConditions,
  onSelectCondition,
  wait,
}: {
  matchedConditions: WaitTermView[];
  onSelectCondition: (conditionName: string) => void;
  wait: WorkflowTaskWait;
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
      {getWaitSummary(wait)}
    </p>
  );
};

const InlineConditionList = ({
  conditions,
  onSelectCondition,
}: {
  conditions: WaitTermView[];
  onSelectCondition: (conditionName: string) => void;
}) => {
  return (
    <>
      {conditions.map((condition, index) => (
        <span key={`${condition.kind}:${condition.technicalName}`}>
          {index > 0 ? ", " : null}
          <button
            className="cursor-pointer text-brand-primary hover:text-blue-700 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
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

export const WaitStatusPill = ({ wait }: { wait: WorkflowTaskWait }) => {
  const color =
    wait.phase === "resolved"
      ? "green"
      : wait.phase === "unknown"
        ? "zinc"
        : "amber";

  return (
    <Badge color={color} title={getWaitStatusLabel(wait.phase)}>
      {getWaitStatusLabel(wait.phase)}
    </Badge>
  );
};

const WaitSection = ({
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

const waitDiagnosticsErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return `Unable to load waiting diagnostics: ${error.message}`;
  }

  return "Unable to load waiting diagnostics.";
};

const WaitDiagnosticsPanel = ({
  diagnosticsState,
}: {
  diagnosticsState: WaitDiagnosticsState;
}) => {
  if (diagnosticsState.isLoading) {
    return (
      <WaitSection title="Waiting diagnostics">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Loading current wait diagnostics…
        </p>
      </WaitSection>
    );
  }

  if (diagnosticsState.error) {
    return (
      <WaitSection title="Waiting diagnostics">
        <p className="text-sm text-red-600 dark:text-red-400">
          {diagnosticsState.error}
        </p>
      </WaitSection>
    );
  }

  const diagnostics = diagnosticsState.value;
  if (!diagnostics) return null;
  const evalMessage = getDiagnosticsEvalMessage(diagnostics);

  return (
    <WaitSection title="Waiting diagnostics">
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>Current status for declared wait inputs.</p>
        <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-3">
          <CompactDiagnosticsField
            label="Workflow attempt"
            value={diagnostics.workflowAttempt.toString()}
          />
          <CompactDiagnosticsField
            label="Inspected"
            value={
              <RelativeTimeFormatter addSuffix time={diagnostics.inspectedAt} />
            }
          />
          <CompactDiagnosticsField
            label="Expression"
            value={
              diagnostics.exprResult === undefined
                ? "Not evaluated"
                : diagnostics.exprResult
                  ? "Satisfied"
                  : "Waiting"
            }
          />
          <CompactDiagnosticsField
            label="Signal scan"
            value={`${diagnostics.signalScanCount.toLocaleString()} / ${diagnostics.signalScanLimit.toLocaleString()}`}
          />
        </dl>
        {diagnostics.truncated ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Signal diagnostics reached the scan limit, so expression and match
            counts are best effort.
          </p>
        ) : null}
        {evalMessage ? (
          <p
            className={
              evalMessage.tone === "neutral"
                ? "text-sm text-slate-600 dark:text-slate-300"
                : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
            }
          >
            {evalMessage.message}
          </p>
        ) : null}
      </div>
    </WaitSection>
  );
};

const CompactDiagnosticsField = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
      {label}
    </dt>
    <dd className="mt-0.5 min-w-0 text-sm text-slate-900 dark:text-slate-100">
      {value}
    </dd>
  </div>
);

const getDiagnosticsEvalMessage = (
  diagnostics: WorkflowTaskWaitDiagnostics,
): { message: string; tone: "neutral" | "warning" } | undefined => {
  if (!diagnostics.evalError) return undefined;

  const hasUnavailableDepOutput = diagnostics.inputs.deps.some(
    (dep) => !dep.available,
  );
  if (diagnostics.phase === "not_started" && hasUnavailableDepOutput) {
    return {
      message: "Waiting for dependency output.",
      tone: "neutral",
    };
  }

  return {
    message: diagnostics.evalError,
    tone: "warning",
  };
};

const WaitFacts = ({ wait }: { wait: WorkflowTaskWait }) => {
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
    wait.evidence
      ? {
          label: "Evaluated",
          value: (
            <RelativeTimeFormatter addSuffix time={wait.evidence.evaluatedAt} />
          ),
        }
      : undefined,
    wait.evidence
      ? {
          label: "Workflow attempt",
          value: wait.evidence.workflowAttempt.toString(),
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

type WaitTermView = {
  dependencyTask?: WorkflowTask;
  exprCel?: string;
  kind: string;
  label: string;
  matched: boolean;
  matchedCount?: number;
  requiredCount?: number;
  result?: WorkflowTaskWait["terms"][number]["result"];
  signal?: WorkflowTaskWait["inputs"]["signals"][number];
  signalTermName?: string;
  sortIndex: number;
  technicalName: string;
  timer?: WorkflowTaskWait["inputs"]["timers"][number];
};

const WaitTermViews = ({
  conditions,
  focusRequest,
  onLoadMore,
  onToggleConditionSignals,
  openSignalSurface,
  signalListStates,
  wait,
}: {
  conditions: WaitTermView[];
  focusRequest: undefined | WaitFocusRequest;
  onLoadMore: (surface: SignalHistorySurface) => void;
  onToggleConditionSignals: (surface: SignalHistorySurface) => void;
  openSignalSurface: SignalHistorySurface | undefined;
  signalListStates: Record<string, SignalInspectorState>;
  wait: WorkflowTaskWait;
}) => {
  const matchedConditions = conditions.filter((condition) => condition.matched);
  const latestConditionsRef = useRef(conditions);
  const conditionRowRefs = useRef(new Map<string, HTMLDivElement>());
  const handledFocusRequestIDRef = useRef<number | undefined>(undefined);

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
    condition: WaitTermView,
    node: HTMLDivElement | null,
  ) => {
    const key = getConditionFocusKey(condition);
    if (node) {
      conditionRowRefs.current.set(key, node);
      return;
    }

    conditionRowRefs.current.delete(key);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {matchedConditions.length.toString()} of {conditions.length.toString()}{" "}
        conditions satisfied
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="hidden gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 md:grid md:grid-cols-[5.75rem_minmax(0,1fr)] dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
          <span>Status</span>
          <span>Condition</span>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {conditions.map((condition) => {
            const conditionSignalState = condition.signal
              ? signalListStates[getConditionSignalStateKey(condition)]
              : undefined;
            const conditionSignalsOpen =
              condition.signal !== undefined &&
              openSignalSurface?.kind === "condition" &&
              getSignalSurfaceStateKey(openSignalSurface) ===
                getConditionSignalStateKey(condition);

            return (
              <ConditionRow
                condition={condition}
                focused={Boolean(
                  focusRequest &&
                  conditionMatchesName(condition, focusRequest.conditionName),
                )}
                key={`${condition.kind}:${condition.technicalName}`}
                onLoadMore={onLoadMore}
                onRegisterRow={registerConditionRow}
                onToggleConditionSignals={onToggleConditionSignals}
                openSignalSurface={openSignalSurface}
                signalListState={
                  conditionSignalState ??
                  (conditionSignalsOpen
                    ? loadingSignalInspectorState
                    : emptySignalInspectorState)
                }
                wait={wait}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ConditionRow = ({
  condition,
  focused,
  onLoadMore,
  onRegisterRow,
  onToggleConditionSignals,
  openSignalSurface,
  signalListState,
  wait,
}: {
  condition: WaitTermView;
  focused: boolean;
  onLoadMore: (surface: SignalHistorySurface) => void;
  onRegisterRow: (condition: WaitTermView, node: HTMLDivElement | null) => void;
  onToggleConditionSignals: (surface: SignalHistorySurface) => void;
  openSignalSurface: SignalHistorySurface | undefined;
  signalListState: SignalInspectorState;
  wait: WorkflowTaskWait;
}) => {
  const stateTone = getConditionStateTone(condition, wait.phase);
  const signal = condition.signal;
  const timer = condition.timer;
  const hasEvidence =
    condition.dependencyTask !== undefined ||
    signal !== undefined ||
    timer !== undefined;
  const showRawTechnicalName = Boolean(condition.exprCel || timer);
  const metadataContent: ReactNode = timer ? (
    <TimerConditionDefinition timer={timer} />
  ) : (
    (condition.exprCel ?? condition.technicalName)
  );

  return (
    <div
      className={clsx(
        "scroll-mt-24 border-l-2 px-3 py-2.5 outline-none",
        stateTone.borderClassName,
        stateTone.rowClassName,
        focused && "ring-1 ring-brand-primary/40 ring-inset",
      )}
      data-testid="wait-term-row"
      ref={(node) => onRegisterRow(condition, node)}
      tabIndex={-1}
    >
      <div className="grid gap-x-3 gap-y-1 md:grid-cols-[5.75rem_minmax(0,1fr)] md:items-start">
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
          {showRawTechnicalName ? (
            <div className="mt-0.5 min-w-0 font-mono text-xs leading-5 break-all text-slate-500 dark:text-slate-400">
              {condition.technicalName}
            </div>
          ) : null}
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            <ConditionKindLabel kind={condition.kind} />
            <span
              aria-hidden="true"
              className="text-slate-400 dark:text-slate-500"
            >
              &bull;
            </span>
            {timer ? (
              <span className="min-w-0 break-words">{metadataContent}</span>
            ) : condition.exprCel ? (
              <code className="rounded border border-slate-200 bg-slate-50 box-decoration-clone px-1 py-0.5 font-mono break-all text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                {metadataContent}
              </code>
            ) : (
              <span className="font-mono break-all">{metadataContent}</span>
            )}
          </div>
        </div>

        {hasEvidence ? (
          <div className="min-w-0 md:col-start-2">
            <ConditionEvidence condition={condition} wait={wait} />
          </div>
        ) : null}
      </div>

      {signal ? (
        <ConditionSignalEvidenceDisclosure
          onLoadMore={onLoadMore}
          onToggle={() =>
            onToggleConditionSignals(signalSurfaceForCondition(condition))
          }
          open={
            openSignalSurface?.kind === "condition" &&
            getSignalSurfaceStateKey(openSignalSurface) ===
              getConditionSignalStateKey(condition)
          }
          phase={wait.phase}
          signal={signal}
          signalListState={signalListState}
          surface={signalSurfaceForCondition(condition)}
        />
      ) : null}
    </div>
  );
};

const ConditionEvidence = ({
  condition,
  wait,
}: {
  condition: WaitTermView;
  wait: WorkflowTaskWait;
}) => {
  const timer = condition.timer;
  if (timer) {
    return <TimerConditionEvidence timer={timer} />;
  }

  const signal = condition.signal;
  if (signal) {
    return (
      <SignalConditionEvidence
        condition={{ ...condition, signal }}
        wait={wait}
      />
    );
  }

  const dependencyTask = condition.dependencyTask;
  if (dependencyTask) {
    return (
      <DependencyConditionEvidence
        condition={{ ...condition, dependencyTask }}
        wait={wait}
      />
    );
  }

  return null;
};

const TimerConditionDefinition = ({
  timer,
}: {
  timer: WorkflowTaskWait["inputs"]["timers"][number];
}) => {
  const delay = getTimerDelayLabel(timer);
  const anchor = timer.anchor;

  if (!delay) {
    if (!anchor) return <>Immediate</>;
    switch (anchor.kind) {
      case "task_finalized_at":
        return anchor.task ? (
          <>
            When <TimerTaskName taskName={anchor.task} /> finalizes
          </>
        ) : (
          <>When dependency finalizes</>
        );
      case "wait_started_at":
        return <>When wait starts</>;
      case "workflow_created_at":
        return <>When workflow starts</>;
      default:
        return anchor.task ? (
          <>
            {anchor.kind.replaceAll("_", " ")} (
            <TimerTaskName taskName={anchor.task} />)
          </>
        ) : (
          <>{anchor.kind.replaceAll("_", " ")}</>
        );
    }
  }

  if (!anchor) return <>After {delay}</>;
  switch (anchor.kind) {
    case "task_finalized_at":
      return anchor.task ? (
        <>
          {delay} after <TimerTaskName taskName={anchor.task} /> finalizes
        </>
      ) : (
        <>{delay} after dependency finalizes</>
      );
    case "wait_started_at":
      return <>{delay} after wait starts</>;
    case "workflow_created_at":
      return <>{delay} after workflow starts</>;
    default:
      return anchor.task ? (
        <>
          {delay} after {anchor.kind.replaceAll("_", " ")} (
          <TimerTaskName taskName={anchor.task} />)
        </>
      ) : (
        <>
          {delay} after {anchor.kind.replaceAll("_", " ")}
        </>
      );
  }
};

const TimerTaskName = ({ taskName }: { taskName: string }) => (
  <span className="font-mono text-slate-700 dark:text-slate-200">
    {taskName}
  </span>
);

const TimerConditionEvidence = ({
  timer,
}: {
  timer: WorkflowTaskWait["inputs"]["timers"][number];
}) => {
  const fired = timer.result?.fired ?? false;
  return (
    <p className="min-w-0 text-xs leading-5 text-slate-600 dark:text-slate-300">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {fired ? "Fired" : "Fires"}
      </span>{" "}
      <TimerTiming timer={timer} />
    </p>
  );
};

const DependencyConditionEvidence = ({
  condition,
  wait,
}: {
  condition: {
    dependencyTask: WorkflowTask;
  } & WaitTermView;
  wait: WorkflowTaskWait;
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
    signal: WorkflowTaskWait["inputs"]["signals"][number];
  } & WaitTermView;
  wait: WorkflowTaskWait;
}) => {
  const signalResult = condition.signal.result;
  const termResult = condition.result ?? undefined;
  return (
    <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
      <dl className="contents">
        <CompactEvidenceField label="Key" value={condition.signal.key} />
        <CompactEvidenceField
          label="Included"
          value={(signalResult?.includedCount ?? 0).toString()}
        />
        {termResult ? (
          <CompactEvidenceField
            label="Matched"
            value={termResult.matchedCount.toString()}
          />
        ) : null}
        {signalResult?.lastIncludedID ? (
          <CompactEvidenceField
            label="Last included"
            value={`#${signalResult.lastIncludedID.toString()}`}
          />
        ) : null}
        {termResult?.lastMatchedID ? (
          <CompactEvidenceField
            label="Last matched"
            value={`#${termResult.lastMatchedID.toString()}`}
          />
        ) : null}
      </dl>
      {condition.matched ? (
        <ConditionSnapshotTiming
          label="Satisfied"
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
  wait: WorkflowTaskWait;
}) => {
  const time = wait.resolvedAt ?? wait.evidence?.evaluatedAt;
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
      <span className="truncate">{getWaitTermKindLabel(kind)}</span>
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
    case "dep_input":
    case "generic":
      return (
        <LinkIcon aria-hidden="true" className={clsx("size-3.5", className)} />
      );
    case "signal":
    case "signal_input":
      return (
        <InboxIcon aria-hidden="true" className={clsx("size-3.5", className)} />
      );
    case "timer":
    case "timer_input":
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
  timer: WorkflowTaskWait["inputs"]["timers"][number];
}) => {
  if (!timer.fireAt) {
    return <span>{formatTimerAnchorWait(timer.anchor)}</span>;
  }

  return <RelativeTimeFormatter addSuffix time={timer.fireAt} />;
};

type SignalHistorySurface =
  | {
      kind: "all";
    }
  | {
      kind: "condition";
      signalKey: string;
      termName?: string;
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

type SignalReadScope = WorkflowTaskSignalListScope;

type WaitDiagnosticsState = {
  error?: string;
  isLoading: boolean;
  value?: WorkflowTaskWaitDiagnostics;
};

const emptyWaitDiagnosticsState: WaitDiagnosticsState = {
  isLoading: false,
};

const emptySignalInspectorState: SignalInspectorState = {
  hasMore: false,
  isLoading: false,
  isLoadingMore: false,
  signals: [],
};

const loadingSignalInspectorState: SignalInspectorState = {
  ...emptySignalInspectorState,
  isLoading: true,
};

const getSignalSurfaceKey = (
  surface: SignalHistorySurface,
): string | undefined =>
  surface.kind === "condition" && !surface.termName
    ? surface.signalKey
    : undefined;

const getSignalSurfaceTermName = (
  surface: SignalHistorySurface,
): string | undefined =>
  surface.kind === "condition" ? surface.termName : undefined;

const getSignalSurfaceStateKey = (surface: SignalHistorySurface): string =>
  surface.kind === "condition"
    ? (surface.termName ?? surface.signalKey)
    : surface.kind;

const getConditionSignalStateKey = (condition: WaitTermView): string =>
  condition.signalTermName ?? condition.signal?.key ?? condition.technicalName;

const signalSurfaceForCondition = (
  condition: WaitTermView,
): SignalHistorySurface => ({
  kind: "condition",
  signalKey: condition.signal?.key ?? condition.technicalName,
  termName: condition.signalTermName,
});

const hasWaitDetails = (wait: WorkflowTaskWait): boolean => {
  return (
    wait.terms.length > 0 ||
    wait.inputs.signals.length > 0 ||
    wait.inputs.timers.length > 0 ||
    wait.inputs.deps.length > 0
  );
};

const buildWaitTermViews = (
  wait: WorkflowTaskWait,
  dependencyTasks?: Record<string, WorkflowTask>,
  diagnostics?: WorkflowTaskWaitDiagnostics,
): WaitTermView[] => {
  const inputs = wait.inputs;
  const usedSignalKeys = new Set<string>();
  const usedTimerNames = new Set<string>();
  const usedDepTasks = new Set<string>();
  const diagnosticsByTerm = new Map(
    diagnostics?.terms.map((term) => [term.name, term]) ?? [],
  );
  const conditions: WaitTermView[] = wait.terms.map((term, index) => {
    const diagnostic = diagnosticsByTerm.get(term.name);
    const signal = term.signalKey
      ? inputs.signals.find((input) => input.key === term.signalKey)
      : undefined;
    const timer = term.timerName
      ? inputs.timers.find((input) => input.name === term.timerName)
      : undefined;

    if (signal) {
      usedSignalKeys.add(signal.key);
    }
    if (timer) {
      usedTimerNames.add(timer.name);
    }

    return {
      exprCel: term.exprCel,
      kind: term.kind,
      label: getWaitTermDisplayLabel(term),
      matched: term.result?.satisfied ?? diagnostic?.satisfied ?? false,
      matchedCount: term.result?.matchedCount ?? diagnostic?.matchedCount,
      requiredCount: term.result?.requiredCount ?? diagnostic?.requiredCount,
      result: term.result,
      signal,
      signalTermName: signal ? term.name : undefined,
      sortIndex: index,
      technicalName: term.name,
      timer,
    };
  });

  inputs.signals.forEach((signal, index) => {
    if (usedSignalKeys.has(signal.key)) return;

    const diagnostic = diagnostics?.inputs.signals.find(
      (input) => input.key === signal.key,
    );
    conditions.push({
      kind: "signal_input",
      label: signal.key,
      matched:
        (signal.result?.includedCount ?? diagnostic?.includedCount ?? 0) > 0,
      signal,
      sortIndex: wait.terms.length + index,
      technicalName: signal.key,
    });
  });

  inputs.timers.forEach((timer, index) => {
    if (usedTimerNames.has(timer.name)) return;

    const diagnostic = diagnostics?.inputs.timers.find(
      (input) => input.name === timer.name,
    );
    conditions.push({
      kind: "timer_input",
      label: humanizeIdentifier(timer.name),
      matched: timer.result?.fired ?? diagnostic?.fired ?? false,
      sortIndex: wait.terms.length + inputs.signals.length + index,
      technicalName: timer.name,
      timer,
    });
  });

  inputs.deps.forEach((dep, index) => {
    if (usedDepTasks.has(dep.taskName)) return;
    usedDepTasks.add(dep.taskName);
    const diagnostic = diagnostics?.inputs.deps.find(
      (input) => input.taskName === dep.taskName,
    );
    conditions.push({
      dependencyTask: dependencyTasks?.[dep.taskName],
      kind: "dep_input",
      label: dep.taskName,
      matched: dep.result?.available ?? diagnostic?.available ?? false,
      sortIndex:
        wait.terms.length +
        inputs.signals.length +
        inputs.timers.length +
        index,
      technicalName: dep.taskName,
    });
  });

  return conditions.sort((leftCondition, rightCondition) =>
    compareConditions(leftCondition, rightCondition, wait.phase),
  );
};

const compareConditions = (
  leftCondition: WaitTermView,
  rightCondition: WaitTermView,
  phase: WorkflowTaskWait["phase"],
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
  condition: WaitTermView,
  phase: WorkflowTaskWait["phase"],
): number => {
  if (condition.matched) return 0;

  if (phase === "resolved") return 1;
  if (condition.timer?.fireAt) return 1;
  if (condition.timer) return 2;
  if (condition.signal) return 3;

  return 4;
};

const getConditionStateLabel = (
  condition: WaitTermView,
  phase: WorkflowTaskWait["phase"],
): string => {
  if (condition.matched) return "Satisfied";
  if (condition.timer?.result?.fired) return "Fired";
  if (phase === "not_started") {
    return condition.timer?.fireAt ? "Scheduled" : "Pending";
  }
  if (phase !== "resolved") {
    return condition.timer?.fireAt ? "Scheduled" : "Waiting";
  }

  return "Not satisfied";
};

const getConditionStateTone = (
  condition: WaitTermView,
  phase: WorkflowTaskWait["phase"],
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

  if (condition.timer?.result?.fired) {
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

const getConditionFocusKey = (condition: WaitTermView): string => {
  return `${condition.kind}:${condition.technicalName}`;
};

const conditionMatchesName = (
  condition: WaitTermView,
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
  conditions: WaitTermView[],
): WaitTermView[] => {
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

const ConditionSignalEvidenceDisclosure = ({
  onLoadMore,
  onToggle,
  open,
  phase,
  signal,
  signalListState,
  surface,
}: {
  onLoadMore: (surface: SignalHistorySurface) => void;
  onToggle: () => void;
  open: boolean;
  phase: WorkflowTaskWait["phase"];
  signal: WorkflowTaskWait["inputs"]["signals"][number];
  signalListState: SignalInspectorState;
  surface: SignalHistorySurface;
}) => {
  const scopeLabel =
    phase === "resolved" ? "Resolution evidence" : "Signal history";
  const signalSummary = getSignalEvidenceSummary(signal);

  return (
    <div className="mt-3 md:ml-[calc(5.75rem+0.75rem)]">
      <button
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md text-left text-sm text-slate-900 hover:text-brand-primary dark:text-slate-100 dark:hover:text-blue-300"
        onClick={onToggle}
        type="button"
      >
        <ChevronRightIcon
          aria-hidden="true"
          className={clsx(
            "size-4 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="font-medium">{scopeLabel}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {signalSummary}
        </span>
      </button>

      {open ? (
        <SignalHistoryPanel
          emptyText={
            phase === "resolved"
              ? "No signals found in the final resolution evidence."
              : "No signals found in the current workflow attempt."
          }
          helperText={
            phase === "resolved"
              ? "Signals included when this wait resolved."
              : "Workflow signals declared by this wait."
          }
          onLoadMore={() => onLoadMore(surface)}
          signalListState={signalListState}
        />
      ) : null}
    </div>
  );
};

const autoOpenSignalEvidenceLimit = 3;

const getAutoOpenSignalEvidenceSurface = (
  conditions: WaitTermView[],
): SignalHistorySurface | undefined => {
  const condition = conditions.find(
    (condition) =>
      condition.signal &&
      (condition.signal.result?.includedCount ?? 0) > 0 &&
      (condition.signal.result?.includedCount ?? 0) <=
        autoOpenSignalEvidenceLimit &&
      condition.matched,
  );
  return condition ? signalSurfaceForCondition(condition) : undefined;
};

const getSignalEvidenceSummary = (
  signal: WorkflowTaskWait["inputs"]["signals"][number],
): string => {
  const includedCount = signal.result?.includedCount ?? 0;
  const availableSignals =
    includedCount === 1
      ? "1 signal included"
      : `${includedCount.toString()} signals included`;

  return availableSignals;
};

const AllTaskSignalsPanel = ({
  onLoadMore,
  onToggle,
  open,
  signalListState,
}: {
  onLoadMore: (surface: SignalHistorySurface) => void;
  onToggle: () => void;
  open: boolean;
  signalListState: SignalInspectorState;
}) => {
  const signalSummary = getLoadedSignalHistorySummary(signalListState);

  return (
    <div className="space-y-3">
      <button
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md text-left text-sm text-slate-900 hover:text-brand-primary dark:text-slate-100 dark:hover:text-blue-300"
        onClick={onToggle}
        type="button"
      >
        <ChevronRightIcon
          aria-hidden="true"
          className={clsx(
            "size-4 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="font-medium">All task signals</span>
        {signalSummary ? (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {signalSummary}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="ml-6">
          <SignalHistoryPanel
            emptyText="No declared signal history found for the current workflow attempt."
            helperText="Workflow signals declared by this wait."
            onLoadMore={() => onLoadMore({ kind: "all" })}
            signalListState={signalListState}
          />
        </div>
      ) : null}
    </div>
  );
};

const SignalHistoryPanel = ({
  emptyText,
  helperText,
  onLoadMore,
  signalListState,
}: {
  emptyText: string;
  helperText: string;
  onLoadMore: () => void;
  signalListState: SignalInspectorState;
}) => {
  const signalCount = signalListState.signals.length;

  return (
    <div className="mt-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">{helperText}</p>

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
          {emptyText}
        </p>
      ) : null}

      {signalCount > 0 ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/20">
          {signalListState.signals.map((signal) => (
            <SignalHistoryItem
              defaultOpen={signalListState.signals.length === 1}
              key={signal.id.toString()}
              signal={signal}
            />
          ))}
        </div>
      ) : null}

      {signalListState.hasMore ? (
        <button
          className="mt-3 text-sm font-medium text-brand-primary hover:text-blue-700 dark:hover:text-blue-300"
          onClick={onLoadMore}
          type="button"
        >
          {signalListState.isLoadingMore
            ? "Loading older signals…"
            : "Load older signals"}
        </button>
      ) : null}
    </div>
  );
};

const getLoadedSignalHistorySummary = (
  signalListState: SignalInspectorState,
): string | undefined => {
  const signalCount = signalListState.signals.length;
  if (signalCount === 0) return undefined;

  return `${signalCount.toString()} shown${
    signalListState.hasMore ? " · older signals available" : ""
  }`;
};

const SignalHistoryItem = ({
  defaultOpen,
  signal,
}: {
  defaultOpen: boolean;
  signal: WorkflowTaskSignal;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="group border-t border-slate-200 first:border-t-0 dark:border-slate-800"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-900/60 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90 dark:text-slate-500"
        />
        <Badge color="light">#{signal.id.toString()}</Badge>
        <span className="font-mono break-all text-slate-900 dark:text-slate-100">
          {signal.key}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          workflow attempt {signal.attempt.toString()}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          <RelativeTimeFormatter addSuffix time={signal.createdAt} />
        </span>
      </summary>

      <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
        <div className="grid gap-3 lg:grid-cols-2">
          <SignalPayloadPanel
            copyTitle="Signal payload"
            data={signal.payload}
            title="Payload"
          />
          <SignalPayloadPanel
            copyTitle="Signal source"
            data={signal.source}
            title="Source"
          />
        </div>
      </div>
    </details>
  );
};

const SignalPayloadPanel = ({
  copyTitle,
  data,
  title,
}: {
  copyTitle: string;
  data: unknown;
  title: string;
}) => {
  return (
    <div className="min-w-0 space-y-1">
      <h6 className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {title}
      </h6>
      <JSONView copyTitle={copyTitle} data={data} defaultExpandDepth={1} />
    </div>
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

const getConditionSignalScope = (wait: WorkflowTaskWait): SignalReadScope =>
  wait.phase === "resolved" ? "evidence" : "history";

const getAllTaskSignalsScope = (): SignalReadScope => "history";

const getWaitStatusLabel = (phase: WorkflowTaskWait["phase"]): string => {
  switch (phase) {
    case "not_started":
      return "Not started";
    case "resolved":
      return "Resolved";
    case "waiting":
      return "Pending";
    default:
      return "Unknown";
  }
};

const getWaitSummary = (wait: WorkflowTaskWait): string => {
  if (wait.summary) {
    return wait.phase === "resolved"
      ? `Resolved by: ${wait.summary}.`
      : wait.summary;
  }

  switch (wait.phase) {
    case "not_started":
      return "Wait has not started because dependencies are still incomplete.";
    case "resolved":
      return "Wait resolved.";
    case "waiting":
      return "Waiting diagnostics are available for this task.";
    default:
      return "Wait state is unavailable.";
  }
};

const getWaitTermKindLabel = (kind: string): string => {
  switch (kind) {
    case "dep_input":
      return "Dependency";
    case "generic":
      return "Generic CEL";
    case "signal":
    case "signal_input":
      return "Signal";
    case "timer":
    case "timer_input":
      return "Timer";
    default:
      return kind.replaceAll("_", " ");
  }
};

const getWaitTermLabel = (term: WorkflowTaskWait["terms"][number]): string => {
  if (!term.label || term.label === term.name) {
    return "—";
  }

  return term.label;
};

const getWaitTermDisplayLabel = (
  term: WorkflowTaskWait["terms"][number],
): string => {
  const label = getWaitTermLabel(term);
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

const formatTimerAnchorWait = (
  anchor: WorkflowTaskWaitTimer["anchor"],
): string => {
  if (!anchor) return "Waiting to schedule";

  switch (anchor.kind) {
    case "task_finalized_at":
      return anchor.task ? `Waiting for ${anchor.task}` : "Waiting for task";
    case "wait_started_at":
      return "Waiting for wait to start";
    case "workflow_created_at":
      return "Waiting for workflow start";
    default:
      return "Waiting to schedule";
  }
};

const getTimerDelayLabel = (
  timer: WorkflowTaskWait["inputs"]["timers"][number],
): string | undefined => {
  if (typeof timer.afterSeconds !== "number") return undefined;

  if (Number.isInteger(timer.afterSeconds)) {
    if (timer.afterSeconds % 3600 === 0) {
      return `${(timer.afterSeconds / 3600).toString()}h`;
    }
    if (timer.afterSeconds % 60 === 0) {
      return `${(timer.afterSeconds / 60).toString()}m`;
    }
  }

  return formatDurationShort(
    new Date(timer.afterSeconds * 1000),
    new Date(0),
    false,
  );
};
