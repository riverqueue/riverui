import {
  type WorkflowTask,
  type WorkflowTaskSignalList,
  type WorkflowTaskWait,
  type WorkflowTaskWaitDiagnostics,
  type WorkflowTaskWaitTimer,
} from "@services/workflows";
import { formatDurationShort } from "@utils/time";

import {
  type SignalHistorySurface,
  type SignalInspectorState,
  type WaitSignalInput,
  type WaitTermResult,
  type WaitTermView,
  type WaitTimerInput,
} from "./WorkflowGateInspector.types";

export const getSignalSurfaceKey = (
  surface: SignalHistorySurface,
): string | undefined =>
  surface.kind === "condition" && !surface.termName
    ? surface.signalKey
    : undefined;

export const getSignalSurfaceTermName = (
  surface: SignalHistorySurface,
): string | undefined =>
  surface.kind === "condition" ? surface.termName : undefined;

export const getSignalSurfaceStateKey = (
  surface: SignalHistorySurface,
): string =>
  surface.kind === "condition"
    ? (surface.termName ?? surface.signalKey)
    : surface.kind;

export const waitDiagnosticsErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return `Unable to load waiting diagnostics: ${error.message}`;
  }

  return "Unable to load waiting diagnostics.";
};

export const getConditionSignalStateKey = (condition: WaitTermView): string =>
  condition.signalTermName ?? condition.signal?.key ?? condition.technicalName;

export const signalSurfaceForCondition = (
  condition: WaitTermView,
): SignalHistorySurface => ({
  kind: "condition",
  signalKey: condition.signal?.key ?? condition.technicalName,
  termName: condition.signalTermName,
});

export const hasWaitDetails = (wait: WorkflowTaskWait): boolean => {
  return (
    wait.terms.length > 0 ||
    wait.inputs.signals.length > 0 ||
    wait.inputs.timers.length > 0 ||
    wait.inputs.deps.length > 0
  );
};

export const buildWaitTermViews = (
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
  const signalDiagnosticsByKey = new Map(
    diagnostics?.inputs.signals.map((signal) => [signal.key, signal]) ?? [],
  );
  const timerDiagnosticsByName = new Map(
    diagnostics?.inputs.timers.map((timer) => [timer.name, timer]) ?? [],
  );
  const conditions: WaitTermView[] = wait.terms.map((term, index) => {
    const diagnostic = diagnosticsByTerm.get(term.name);
    const signal = term.signalKey
      ? inputs.signals.find((input) => input.key === term.signalKey)
      : undefined;
    const timer = term.timerName
      ? inputs.timers.find((input) => input.name === term.timerName)
      : undefined;
    const result = mergeWaitTermResult(term.result, diagnostic);
    const mergedSignal = signal
      ? mergeSignalInputDiagnostics(
          signal,
          signalDiagnosticsByKey.get(signal.key),
        )
      : undefined;
    const mergedTimer = timer
      ? mergeTimerInputDiagnostics(
          timer,
          timerDiagnosticsByName.get(timer.name),
        )
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
      matched: result?.satisfied ?? false,
      result,
      signal: mergedSignal,
      signalTermName: signal ? term.name : undefined,
      sortIndex: index,
      technicalName: term.name,
      timer: mergedTimer,
    };
  });

  inputs.signals.forEach((signal, index) => {
    if (usedSignalKeys.has(signal.key)) return;

    const diagnostic = signalDiagnosticsByKey.get(signal.key);
    const mergedSignal = mergeSignalInputDiagnostics(signal, diagnostic);
    conditions.push({
      kind: "signal_input",
      label: signal.key,
      matched: (mergedSignal.result?.includedCount ?? 0) > 0,
      signal: mergedSignal,
      sortIndex: wait.terms.length + index,
      technicalName: signal.key,
    });
  });

  inputs.timers.forEach((timer, index) => {
    if (usedTimerNames.has(timer.name)) return;

    const diagnostic = timerDiagnosticsByName.get(timer.name);
    const mergedTimer = mergeTimerInputDiagnostics(timer, diagnostic);
    conditions.push({
      kind: "timer_input",
      label: humanizeIdentifier(timer.name),
      matched: mergedTimer.result?.fired ?? false,
      sortIndex: wait.terms.length + inputs.signals.length + index,
      technicalName: timer.name,
      timer: mergedTimer,
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

const mergeWaitTermResult = (
  result: WorkflowTaskWait["terms"][number]["result"],
  diagnostic?: WorkflowTaskWaitDiagnostics["terms"][number],
): undefined | WaitTermResult => {
  if (!diagnostic) return result;

  return {
    lastMatchedID: diagnostic.lastMatchedID ?? result?.lastMatchedID,
    matchedCount: diagnostic.matchedCount,
    requiredCount: diagnostic.requiredCount,
    satisfied: diagnostic.satisfied,
  };
};

const mergeSignalInputDiagnostics = (
  signal: WaitSignalInput,
  diagnostic?: WorkflowTaskWaitDiagnostics["inputs"]["signals"][number],
): WaitSignalInput => {
  if (!diagnostic) return signal;

  return {
    ...signal,
    result: {
      includedCount: diagnostic.includedCount,
      lastIncludedID: diagnostic.lastID ?? signal.result?.lastIncludedID,
    },
  };
};

const mergeTimerInputDiagnostics = (
  timer: WaitTimerInput,
  diagnostic?: WorkflowTaskWaitDiagnostics["inputs"]["timers"][number],
): WaitTimerInput => {
  if (!diagnostic) return timer;

  return {
    ...timer,
    fireAt: diagnostic.fireAt ?? timer.fireAt,
    result: {
      fireAt: diagnostic.fireAt ?? timer.result?.fireAt,
      fired: diagnostic.fired,
    },
  };
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

export const getConditionStateLabel = (
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

export const getConditionStateTone = (
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

export const getConditionFocusKey = (condition: WaitTermView): string => {
  return `${condition.kind}:${condition.technicalName}`;
};

export const conditionMatchesName = (
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

export const orderConditionsForSummary = (
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

const autoOpenSignalEvidenceLimit = 3;

export const getAutoOpenSignalEvidenceSurface = (
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

export const getSignalEvidenceSummary = (
  signal: WorkflowTaskWait["inputs"]["signals"][number],
): string => {
  const includedCount = signal.result?.includedCount ?? 0;
  return includedCount === 1
    ? "1 signal included"
    : `${includedCount.toString()} signals included`;
};

export const getLoadedSignalHistorySummary = (
  signalListState: SignalInspectorState,
): string | undefined => {
  const signalCount = signalListState.signals.length;
  if (signalCount === 0) return undefined;

  return `${signalCount.toString()} shown${
    signalListState.hasMore ? " · older signals available" : ""
  }`;
};

export const signalInspectorStateFromSignalList = (
  signalList: WorkflowTaskSignalList,
): SignalInspectorState => ({
  error: undefined,
  hasMore: signalList.hasMore,
  isLoading: false,
  isLoadingMore: false,
  nextCursorID: signalList.nextCursorID,
  signals: signalList.signals,
});

export const getConditionSignalScope = (
  wait: WorkflowTaskWait,
): WorkflowTaskSignalList["scope"] =>
  wait.phase === "resolved" ? "evidence" : "history";

export const getWaitStatusLabel = (
  phase: WorkflowTaskWait["phase"],
): string => {
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

export const getWaitSummary = (wait: WorkflowTaskWait): string => {
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

export const getWaitTermKindLabel = (kind: string): string => {
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

export const formatTimerAnchorWait = (
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

export const getTimerDelayLabel = (
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
