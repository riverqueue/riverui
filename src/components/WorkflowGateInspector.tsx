import { Subheading } from "@components/Heading";
import PlaintextPanel from "@components/PlaintextPanel";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  getWorkflowTaskSignals,
  getWorkflowTaskWaitDiagnostics,
} from "@services/workflows";
import { useEffect, useMemo, useState } from "react";

import {
  buildWaitTermViews,
  getAutoOpenSignalEvidenceSurface,
  getConditionSignalScope,
  getSignalSurfaceKey,
  getSignalSurfaceStateKey,
  getSignalSurfaceTermName,
  hasWaitDetails,
  orderConditionsForSummary,
  signalInspectorStateFromSignalList,
  waitDiagnosticsErrorMessage,
} from "./WorkflowGateInspector.model";
import {
  emptySignalInspectorState,
  emptyWaitDiagnosticsState,
  type SignalHistorySurface,
  type SignalInspectorState,
  type WaitFocusRequest,
  type WorkflowWaitInspectorProps,
} from "./WorkflowGateInspector.types";
import { WaitTermViews } from "./WorkflowGateInspectorConditions";
import { WaitDiagnosticsPanel } from "./WorkflowGateInspectorDiagnostics";
import { AllTaskSignalsPanel } from "./WorkflowGateInspectorSignals";
import {
  WaitFacts,
  WaitSection,
  WaitStatusPill,
  WaitSummary,
} from "./WorkflowGateInspectorSummary";

export type {
  TaskSignalLoader,
  TaskWaitDiagnosticsLoader,
  WaitFocusRequest,
} from "./WorkflowGateInspector.types";
export {
  ConditionKindIcon,
  WaitTermViews,
} from "./WorkflowGateInspectorConditions";
export { WaitStatusPill } from "./WorkflowGateInspectorSummary";

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
  const [diagnosticsState, setDiagnosticsState] = useState(
    emptyWaitDiagnosticsState,
  );
  const [openSignalSurfaceContextKey, setOpenSignalSurfaceContextKey] =
    useState<string>();
  const [openSignalSurface, setOpenSignalSurface] =
    useState<SignalHistorySurface>();
  const [dismissedAutoOpenSignalKey, setDismissedAutoOpenSignalKey] =
    useState<string>();
  const [conditionSignalStates, setConditionSignalStates] = useState<
    Record<string, SignalInspectorState>
  >({});
  const [allSignalListState, setAllSignalListState] = useState(
    emptySignalInspectorState,
  );

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
  const autoOpenSignalSurfaceCandidate = useMemo(
    () => getAutoOpenSignalEvidenceSurface(conditions),
    [conditions],
  );
  const conditionSignalScope = getConditionSignalScope(wait);
  const allTaskSignalsScope = "history";
  const hasSignals = wait.inputs.signals.length > 0;
  const signalHistoryKey = `${workflowID}:${taskName}:${wait.evidence?.workflowAttempt.toString() ?? ""}:${wait.phase}`;
  const focusDetailsOpen =
    focusRequest !== undefined &&
    closedFocusRequestID !== focusRequest.requestID;
  const detailsVisible = detailsOpen || focusDetailsOpen;
  const activeFocusRequest = focusRequest ?? conditionFocusRequest;
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
                key={signalHistoryKey}
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
              copyTitle="Wait expression"
              text={wait.exprCel || "No CEL expression declared"}
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
