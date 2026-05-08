import {
  getWorkflowTaskSignals,
  getWorkflowTaskWaitDiagnostics,
  type WorkflowTask,
  type WorkflowTaskSignal,
  type WorkflowTaskWait,
  type WorkflowTaskWaitDiagnostics,
} from "@services/workflows";

export type SignalHistorySurface =
  | {
      kind: "all";
    }
  | {
      kind: "condition";
      signalKey: string;
      termName?: string;
    };

export type SignalInspectorState = {
  error?: string;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  nextCursorID?: bigint;
  signals: WorkflowTaskSignal[];
};

export type TaskSignalLoader = typeof getWorkflowTaskSignals;
export type TaskWaitDiagnosticsLoader = typeof getWorkflowTaskWaitDiagnostics;

export type WaitDiagnosticsState = {
  error?: string;
  isLoading: boolean;
  value?: WorkflowTaskWaitDiagnostics;
};

export type WaitFocusRequest = {
  conditionName: string;
  requestID: number;
};

export type WaitSignalInput = WorkflowTaskWait["inputs"]["signals"][number];
export type WaitTermResult = NonNullable<
  WorkflowTaskWait["terms"][number]["result"]
>;

export type WaitTermView = {
  dependencyTask?: WorkflowTask;
  exprCel?: string;
  kind: string;
  label: string;
  matched: boolean;
  result?: WorkflowTaskWait["terms"][number]["result"];
  signal?: WorkflowTaskWait["inputs"]["signals"][number];
  signalTermName?: string;
  sortIndex: number;
  technicalName: string;
  timer?: WorkflowTaskWait["inputs"]["timers"][number];
};

export type WaitTimerInput = WorkflowTaskWait["inputs"]["timers"][number];

export type WorkflowWaitInspectorProps = {
  dependencyTasks?: Record<string, WorkflowTask>;
  focusRequest?: undefined | WaitFocusRequest;
  loadTaskSignals?: TaskSignalLoader;
  loadTaskWaitDiagnostics?: TaskWaitDiagnosticsLoader;
  onSelectCondition?: (conditionName: string) => void;
  taskName: string;
  wait: WorkflowTaskWait;
  workflowID: string;
};

export const emptyWaitDiagnosticsState: WaitDiagnosticsState = {
  isLoading: false,
};

export const emptySignalInspectorState: SignalInspectorState = {
  hasMore: false,
  isLoading: false,
  isLoadingMore: false,
  signals: [],
};

export const loadingSignalInspectorState: SignalInspectorState = {
  ...emptySignalInspectorState,
  isLoading: true,
};
