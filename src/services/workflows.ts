import type { MutationFunction, QueryFunction } from "@tanstack/react-query";

import {
  apiJobMinimalToJobMinimal,
  apiJobToJob,
  JobFromAPI,
  JobMinimal,
  JobMinimalFromAPI,
  JobWithKnownMetadata,
} from "@services/jobs";
import { API } from "@utils/api";

import { ListResponse } from "./listResponse";
import {
  SnakeToCamelCase,
  StringEndingWithUnderscoreAt,
  WorkflowState,
} from "./types";

export type Workflow = {
  id: string;
  name: string;
  tasks: WorkflowTask[];
};

export type WorkflowRetryMode = "all" | "failed_and_downstream" | "failed_only";

export type WorkflowTask = {
  deps: string[];
  ignoreCancelledDeps: boolean;
  ignoreDeletedDeps: boolean;
  ignoreDiscardedDeps: boolean;
  name: string;
  stagedAt?: Date;
  wait?: WorkflowTaskWait;
  waitReason: WorkflowTaskWaitReason;
  workflowID: string;
} & JobWithKnownMetadata;

export type WorkflowTaskSignal = {
  attempt: number;
  createdAt: Date;
  id: bigint;
  key: string;
  payload: unknown;
  source: unknown;
};

export type WorkflowTaskSignalList = {
  evidence?: WorkflowTaskWaitEvidence;
  hasMore: boolean;
  nextCursorID?: bigint;
  scope: WorkflowTaskSignalListScope;
  signals: WorkflowTaskSignal[];
};

export type WorkflowTaskSignalListScope = "evidence" | "history";

export type WorkflowTaskWait = {
  evidence?: WorkflowTaskWaitEvidence;
  exprCel: string;
  inputs: WorkflowTaskWaitInputs;
  phase: WorkflowTaskWaitPhase;
  resolvedAt?: Date;
  startedAt?: Date;
  summary?: string;
  terms: WorkflowTaskWaitTerm[];
};

export type WorkflowTaskWaitDepInput = {
  result?: WorkflowTaskWaitDepInputResult;
  taskName: string;
};

export type WorkflowTaskWaitDepInputResult = {
  available: boolean;
  finalizedAt?: Date;
  state?: string;
};

export type WorkflowTaskWaitDiagnostics = {
  evalError?: string;
  exprResult?: boolean;
  inputs: WorkflowWaitInputDiagnostics;
  inspectedAt: Date;
  phase: WorkflowTaskWaitPhase;
  signalScanCount: number;
  signalScanLimit: number;
  terms: WorkflowWaitTermDiagnostic[];
  truncated: boolean;
  workflowAttempt: number;
};

export type WorkflowTaskWaitEvidence = {
  evaluatedAt: Date;
  workflowAttempt: number;
};

export type WorkflowTaskWaitInputs = {
  deps: WorkflowTaskWaitDepInput[];
  signals: WorkflowTaskWaitSignalInput[];
  timers: WorkflowTaskWaitTimer[];
};

export type WorkflowTaskWaitPhase =
  | "not_started"
  | "resolved"
  | "unknown"
  | "waiting";

export type WorkflowTaskWaitReason =
  | "dependencies_and_wait"
  | "dependencies"
  | "none"
  | "wait";

export type WorkflowTaskWaitSignalInput = {
  key: string;
  result?: WorkflowTaskWaitSignalInputResult;
};

export type WorkflowTaskWaitSignalInputResult = {
  includedCount: number;
  lastIncludedID?: bigint;
};

export type WorkflowTaskWaitTerm = {
  exprCel?: string;
  kind: string;
  label: string;
  name: string;
  result?: WorkflowTaskWaitTermResult;
  signalKey?: string;
  timerName?: string;
};

export type WorkflowTaskWaitTermResult = {
  lastMatchedID?: bigint;
  matchedCount: number;
  requiredCount: number;
  satisfied: boolean;
};

export type WorkflowTaskWaitTimer = {
  after?: string;
  afterSeconds?: number;
  afterUs?: number;
  anchor?: WorkflowTaskWaitTimerAnchor;
  fireAt?: Date;
  name: string;
  result?: WorkflowTaskWaitTimerResult;
};

export type WorkflowTaskWaitTimerAnchor = {
  kind: string;
  task?: string;
};

export type WorkflowTaskWaitTimerResult = {
  fireAt?: Date;
  fired: boolean;
};

export type WorkflowWaitDepDiagnostic = {
  available: boolean;
  finalizedAt?: Date;
  state?: string;
  taskName: string;
};

export type WorkflowWaitInputDiagnostics = {
  deps: WorkflowWaitDepDiagnostic[];
  signals: WorkflowWaitSignalDiagnostic[];
  timers: WorkflowWaitTimerDiagnostic[];
};

export type WorkflowWaitSignalDiagnostic = {
  includedCount: number;
  key: string;
  lastID?: bigint;
};

export type WorkflowWaitTermDiagnostic = {
  lastMatchedID?: bigint;
  matchedCount: number;
  name: string;
  requiredCount: number;
  satisfied: boolean;
};

export type WorkflowWaitTimerDiagnostic = {
  fireAt?: Date;
  fired: boolean;
  name: string;
};

type CancelPayload = {
  workflowID: string;
};

type CancelResponse = {
  cancelledJobs: JobMinimal[];
};

type CancelResponseFromAPI = {
  cancelled_jobs: JobMinimalFromAPI[];
};

// Represents Job as received from the API. This just like Job, except with
// string dates instead of Date objects and keys as snake_case instead of
// camelCase.
type WorkflowFromAPI = {
  id: string;
  name: string;
  tasks: WorkflowTaskFromAPI[];
};

type WorkflowTaskFromAPI = {
  deps: string[];
  ignore_cancelled_deps: boolean;
  ignore_deleted_deps: boolean;
  ignore_discarded_deps: boolean;
  name: string;
  staged_at?: string;
  wait?: WorkflowTaskWaitFromAPI;
  wait_reason: WorkflowTaskWaitReasonFromAPI;
  workflow_id: string;
} & JobFromAPI;

type WorkflowTaskSignalFromAPI = {
  attempt: number;
  created_at: string;
  id: number | string;
  key: string;
  payload: unknown;
  source: unknown;
};

type WorkflowTaskSignalListFromAPI = {
  evidence?: WorkflowTaskWaitEvidenceFromAPI;
  has_more: boolean;
  next_cursor_id?: number | string;
  scope: string;
  signals: WorkflowTaskSignalFromAPI[];
};

type WorkflowTaskWaitDepInputFromAPI = {
  result?: WorkflowTaskWaitDepInputResultFromAPI;
  task_name: string;
};

type WorkflowTaskWaitDepInputResultFromAPI = {
  available: boolean;
  finalized_at?: string;
  state?: string;
};

type WorkflowTaskWaitDiagnosticsFromAPI = {
  eval_error?: string;
  expr_result?: boolean;
  inputs: WorkflowWaitInputDiagnosticsFromAPI;
  inspected_at: string;
  phase: string;
  signal_scan_count: number;
  signal_scan_limit: number;
  terms: WorkflowWaitTermDiagnosticFromAPI[];
  truncated: boolean;
  workflow_attempt: number;
};

type WorkflowTaskWaitEvidenceFromAPI = {
  evaluated_at: string;
  workflow_attempt: number;
};

type WorkflowTaskWaitFromAPI = {
  evidence?: WorkflowTaskWaitEvidenceFromAPI;
  expr_cel: string;
  inputs: WorkflowTaskWaitInputsFromAPI;
  phase: string;
  resolved_at?: string;
  started_at?: string;
  summary?: string;
  terms: WorkflowTaskWaitTermFromAPI[];
};

type WorkflowTaskWaitInputsFromAPI = {
  deps: WorkflowTaskWaitDepInputFromAPI[];
  signals: WorkflowTaskWaitSignalInputFromAPI[];
  timers: WorkflowTaskWaitTimerFromAPI[];
};

type WorkflowTaskWaitReasonFromAPI = WorkflowTaskWaitReason;

type WorkflowTaskWaitSignalInputFromAPI = {
  key: string;
  result?: WorkflowTaskWaitSignalInputResultFromAPI;
};

type WorkflowTaskWaitSignalInputResultFromAPI = {
  included_count: number;
  last_included_id?: number | string;
};

type WorkflowTaskWaitTermFromAPI = {
  expr_cel?: string;
  kind: string;
  label: string;
  name: string;
  result?: WorkflowTaskWaitTermResultFromAPI;
  signal_key?: string;
  timer_name?: string;
};

type WorkflowTaskWaitTermResultFromAPI = {
  last_matched_id?: number | string;
  matched_count: number;
  required_count: number;
  satisfied: boolean;
};

type WorkflowTaskWaitTimerAnchorFromAPI = {
  kind: string;
  task?: string;
};

type WorkflowTaskWaitTimerFromAPI = {
  after?: string;
  after_seconds?: number;
  after_us?: number;
  anchor?: WorkflowTaskWaitTimerAnchorFromAPI;
  fire_at?: string;
  name: string;
  result?: WorkflowTaskWaitTimerResultFromAPI;
};

type WorkflowTaskWaitTimerResultFromAPI = {
  fire_at?: string;
  fired: boolean;
};

type WorkflowWaitDepDiagnosticFromAPI = {
  available: boolean;
  finalized_at?: string;
  state?: string;
  task_name: string;
};

type WorkflowWaitInputDiagnosticsFromAPI = {
  deps: WorkflowWaitDepDiagnosticFromAPI[];
  signals: WorkflowWaitSignalDiagnosticFromAPI[];
  timers: WorkflowWaitTimerDiagnosticFromAPI[];
};

type WorkflowWaitSignalDiagnosticFromAPI = {
  included_count: number;
  key: string;
  last_id?: number | string;
};

type WorkflowWaitTermDiagnosticFromAPI = {
  last_matched_id?: number | string;
  matched_count: number;
  name: string;
  required_count: number;
  satisfied: boolean;
};

type WorkflowWaitTimerDiagnosticFromAPI = {
  fire_at?: string;
  fired: boolean;
  name: string;
};

export const cancelJobs: MutationFunction<
  CancelResponse,
  CancelPayload
> = async ({ workflowID }) => {
  const response = await API.post<never, CancelResponseFromAPI>(
    `/pro/workflows/${workflowID}/cancel`,
  );

  return {
    cancelledJobs: response.cancelled_jobs.map(apiJobMinimalToJobMinimal),
  };
};

type RetryWorkflowPayload = {
  mode?: WorkflowRetryMode;
  resetHistory?: boolean;
  workflowID: string;
};

type RetryWorkflowResponse = {
  retriedJobs: JobMinimal[];
};

type RetryWorkflowResponseFromAPI = {
  retried_jobs: JobMinimalFromAPI[];
};

export const retryWorkflow: MutationFunction<
  RetryWorkflowResponse,
  RetryWorkflowPayload
> = async ({ mode, resetHistory, workflowID }) => {
  const bodyObj: Record<string, unknown> = {};
  if (mode) bodyObj.mode = mode;
  if (typeof resetHistory === "boolean") bodyObj.reset_history = resetHistory;

  const response = await API.post<string, RetryWorkflowResponseFromAPI>(
    `/pro/workflows/${workflowID}/retry`,
    Object.keys(bodyObj).length ? JSON.stringify(bodyObj) : undefined,
    Object.keys(bodyObj).length
      ? { headers: { "Content-Type": "application/json" } }
      : undefined,
  );

  return {
    retriedJobs: response.retried_jobs.map(apiJobMinimalToJobMinimal),
  };
};

type GetWorkflowKey = ["getWorkflow", string];

export const getWorkflowKey = (id: string): GetWorkflowKey => {
  return ["getWorkflow", id.toString()];
};

export const getWorkflow: QueryFunction<Workflow, GetWorkflowKey> = async ({
  queryKey,
  signal,
}) => {
  const [, workflowID] = queryKey;
  return API.get<WorkflowFromAPI>(
    { path: `/pro/workflows/${workflowID}` },
    { signal },
  ).then(apiWorkflowToWorkflow);
};

type GetWorkflowTaskSignalsPayload = {
  cursorID?: bigint | number | string;
  desc?: boolean;
  key?: string;
  limit?: number;
  scope?: WorkflowTaskSignalListScope;
  signal?: AbortSignal;
  taskName: string;
  termName?: string;
  workflowAttempt?: number;
  workflowID: string;
};

export const getWorkflowTaskSignals = async ({
  cursorID,
  desc = true,
  key,
  limit = 20,
  scope,
  signal,
  taskName,
  termName,
  workflowAttempt,
  workflowID,
}: GetWorkflowTaskSignalsPayload): Promise<WorkflowTaskSignalList> => {
  const query = new URLSearchParams({
    desc: desc.toString(),
    limit: limit.toString(),
    task_name: taskName,
  });
  if (key) {
    query.set("key", key);
  }
  if (cursorID !== undefined) {
    query.set("cursor_id", cursorID.toString());
  }
  if (scope) {
    query.set("scope", scope);
  }
  if (termName) {
    query.set("term_name", termName);
  }
  if (workflowAttempt !== undefined) {
    query.set("workflow_attempt", workflowAttempt.toString());
  }
  return API.get<WorkflowTaskSignalListFromAPI>(
    { path: `/pro/workflows/${workflowID}/task-signals`, query },
    { signal },
  ).then(apiWorkflowTaskSignalListToWorkflowTaskSignalList);
};

type GetWorkflowTaskWaitDiagnosticsPayload = {
  signal?: AbortSignal;
  taskName: string;
  workflowID: string;
};

export const getWorkflowTaskWaitDiagnostics = async ({
  signal,
  taskName,
  workflowID,
}: GetWorkflowTaskWaitDiagnosticsPayload): Promise<WorkflowTaskWaitDiagnostics> => {
  const query = new URLSearchParams({ task_name: taskName });

  return API.get<WorkflowTaskWaitDiagnosticsFromAPI>(
    { path: `/pro/workflows/${workflowID}/task-wait-diagnostics`, query },
    { signal },
  ).then(apiWorkflowTaskWaitDiagnosticsToWorkflowTaskWaitDiagnostics);
};

const apiWorkflowToWorkflow = (workflow: WorkflowFromAPI): Workflow => ({
  id: workflow.id,
  name: workflow.name,
  tasks: workflow.tasks.map(apiWorkflowTaskToWorkflowTask),
});

const apiWorkflowTaskToWorkflowTask = (
  taskFromAPI: WorkflowTaskFromAPI,
): WorkflowTask => {
  return {
    ...(apiJobToJob(taskFromAPI) as JobWithKnownMetadata),
    deps: taskFromAPI.deps,
    ignoreCancelledDeps: taskFromAPI.ignore_cancelled_deps,
    ignoreDeletedDeps: taskFromAPI.ignore_deleted_deps,
    ignoreDiscardedDeps: taskFromAPI.ignore_discarded_deps,
    name: taskFromAPI.name,
    stagedAt: parseDate(taskFromAPI.staged_at),
    wait: apiWorkflowTaskWaitToWorkflowTaskWait(taskFromAPI.wait),
    waitReason: taskFromAPI.wait_reason,
    workflowID: taskFromAPI.workflow_id,
  };
};

const apiWorkflowTaskWaitToWorkflowTaskWait = (
  wait: undefined | WorkflowTaskWaitFromAPI,
): undefined | WorkflowTaskWait => {
  if (!wait) return undefined;

  const inputs = apiWorkflowTaskWaitInputsToWorkflowTaskWaitInputs(wait.inputs);

  return {
    evidence: apiWorkflowTaskWaitEvidenceToWorkflowTaskWaitEvidence(
      wait.evidence,
    ),
    exprCel: wait.expr_cel,
    inputs,
    phase: parseWorkflowTaskWaitPhase(wait.phase),
    resolvedAt: parseDate(wait.resolved_at),
    startedAt: parseDate(wait.started_at),
    summary: wait.summary,
    terms: wait.terms.map(apiWorkflowTaskWaitTermToWorkflowTaskWaitTerm),
  };
};

const parseWorkflowTaskWaitPhase = (phase: unknown): WorkflowTaskWaitPhase => {
  if (phase === "not_started" || phase === "waiting" || phase === "resolved") {
    return phase;
  }

  return "unknown";
};

const apiWorkflowTaskWaitTermToWorkflowTaskWaitTerm = (
  term: WorkflowTaskWaitTermFromAPI,
): WorkflowTaskWaitTerm => ({
  exprCel: term.expr_cel,
  kind: term.kind,
  label: term.label,
  name: term.name,
  result: apiWorkflowTaskWaitTermResultToWorkflowTaskWaitTermResult(
    term.result,
  ),
  signalKey: term.signal_key,
  timerName: term.timer_name,
});

const apiWorkflowTaskWaitInputsToWorkflowTaskWaitInputs = (
  inputs: undefined | WorkflowTaskWaitInputsFromAPI,
): WorkflowTaskWaitInputs => ({
  deps: (inputs?.deps ?? []).map(
    apiWorkflowTaskWaitDepInputToWorkflowTaskWaitDepInput,
  ),
  signals: (inputs?.signals ?? []).map(
    apiWorkflowTaskWaitSignalInputToWorkflowTaskWaitSignalInput,
  ),
  timers: (inputs?.timers ?? []).map(
    apiWorkflowTaskWaitTimerToWorkflowTaskWaitTimer,
  ),
});

const apiWorkflowTaskWaitEvidenceToWorkflowTaskWaitEvidence = (
  evidence: undefined | WorkflowTaskWaitEvidenceFromAPI,
): undefined | WorkflowTaskWaitEvidence => {
  if (!evidence) return undefined;

  return {
    evaluatedAt: parseDateRequired(evidence.evaluated_at, "evaluated_at"),
    workflowAttempt: evidence.workflow_attempt,
  };
};

const apiWorkflowTaskWaitDepInputToWorkflowTaskWaitDepInput = (
  dep: WorkflowTaskWaitDepInputFromAPI,
): WorkflowTaskWaitDepInput => ({
  result: dep.result
    ? {
        available: dep.result.available,
        finalizedAt: parseDate(dep.result.finalized_at),
        state: dep.result.state,
      }
    : undefined,
  taskName: dep.task_name,
});

const apiWorkflowTaskWaitSignalInputToWorkflowTaskWaitSignalInput = (
  signal: WorkflowTaskWaitSignalInputFromAPI,
): WorkflowTaskWaitSignalInput => ({
  key: signal.key,
  result: signal.result
    ? {
        includedCount: signal.result.included_count,
        lastIncludedID: parseBigInt(signal.result.last_included_id),
      }
    : undefined,
});

const apiWorkflowTaskWaitTermResultToWorkflowTaskWaitTermResult = (
  result: undefined | WorkflowTaskWaitTermResultFromAPI,
): undefined | WorkflowTaskWaitTermResult => {
  if (!result) return undefined;

  return {
    lastMatchedID: parseBigInt(result.last_matched_id),
    matchedCount: result.matched_count,
    requiredCount: result.required_count,
    satisfied: result.satisfied,
  };
};

const apiWorkflowTaskWaitTimerToWorkflowTaskWaitTimer = (
  timer: WorkflowTaskWaitTimerFromAPI,
): WorkflowTaskWaitTimer => {
  return {
    after: timer.after,
    afterSeconds: timer.after_seconds,
    afterUs: timer.after_us,
    anchor: apiWorkflowTaskWaitTimerAnchorToWorkflowTaskWaitTimerAnchor(
      timer.anchor,
    ),
    fireAt: parseDate(timer.fire_at),
    name: timer.name,
    result: timer.result
      ? {
          fireAt: parseDate(timer.result.fire_at),
          fired: timer.result.fired,
        }
      : undefined,
  };
};

const apiWorkflowTaskWaitTimerAnchorToWorkflowTaskWaitTimerAnchor = (
  anchor: undefined | WorkflowTaskWaitTimerAnchorFromAPI,
): undefined | WorkflowTaskWaitTimerAnchor => {
  if (!anchor || !anchor.kind) return undefined;

  return {
    kind: anchor.kind,
    task: anchor.task,
  };
};

const apiWorkflowTaskSignalListToWorkflowTaskSignalList = (
  signalList: WorkflowTaskSignalListFromAPI,
): WorkflowTaskSignalList => ({
  evidence: apiWorkflowTaskWaitEvidenceToWorkflowTaskWaitEvidence(
    signalList.evidence,
  ),
  hasMore: signalList.has_more,
  nextCursorID: parseBigInt(signalList.next_cursor_id),
  scope: parseWorkflowTaskSignalListScope(signalList.scope),
  signals: signalList.signals.map(apiWorkflowTaskSignalToWorkflowTaskSignal),
});

const parseWorkflowTaskSignalListScope = (
  scope: unknown,
): WorkflowTaskSignalListScope => {
  if (scope === "evidence" || scope === "history") {
    return scope;
  }

  return "history";
};

const apiWorkflowTaskSignalToWorkflowTaskSignal = (
  signal: WorkflowTaskSignalFromAPI,
): WorkflowTaskSignal => ({
  attempt: signal.attempt,
  createdAt: parseDateRequired(signal.created_at, "created_at"),
  id: parseBigIntRequired(signal.id, "id"),
  key: signal.key,
  payload: signal.payload,
  source: signal.source,
});

const apiWorkflowTaskWaitDiagnosticsToWorkflowTaskWaitDiagnostics = (
  diagnostics: WorkflowTaskWaitDiagnosticsFromAPI,
): WorkflowTaskWaitDiagnostics => ({
  evalError: diagnostics.eval_error,
  exprResult: diagnostics.expr_result,
  inputs: {
    deps: diagnostics.inputs.deps.map((dep) => ({
      available: dep.available,
      finalizedAt: parseDate(dep.finalized_at),
      state: dep.state,
      taskName: dep.task_name,
    })),
    signals: diagnostics.inputs.signals.map((signal) => ({
      includedCount: signal.included_count,
      key: signal.key,
      lastID: parseBigInt(signal.last_id),
    })),
    timers: diagnostics.inputs.timers.map((timer) => ({
      fireAt: parseDate(timer.fire_at),
      fired: timer.fired,
      name: timer.name,
    })),
  },
  inspectedAt: parseDateRequired(diagnostics.inspected_at, "inspected_at"),
  phase: parseWorkflowTaskWaitPhase(diagnostics.phase),
  signalScanCount: diagnostics.signal_scan_count,
  signalScanLimit: diagnostics.signal_scan_limit,
  terms: diagnostics.terms.map((term) => ({
    lastMatchedID: parseBigInt(term.last_matched_id),
    matchedCount: term.matched_count,
    name: term.name,
    requiredCount: term.required_count,
    satisfied: term.satisfied,
  })),
  truncated: diagnostics.truncated,
  workflowAttempt: diagnostics.workflow_attempt,
});

const parseDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseDateRequired = (value: unknown, field: string): Date => {
  const parsed = parseDate(value);
  if (!parsed) {
    throw new Error(`Invalid ${field} value in workflow response`);
  }
  return parsed;
};

const parseBigInt = (value: unknown): bigint | undefined => {
  if (typeof value !== "number" && typeof value !== "string") {
    return undefined;
  }

  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
};

const parseBigIntRequired = (value: unknown, field: string): bigint => {
  const parsed = parseBigInt(value);
  if (parsed === undefined) {
    throw new Error(`Invalid ${field} value in workflow response`);
  }
  return parsed;
};

export type ListWorkflowsKey = [
  "listWorkflows",
  undefined | WorkflowState,
  number,
];

export type WorkflowListItem = {
  [Key in keyof WorkflowListItemFromAPI as SnakeToCamelCase<Key>]: Key extends
    | StringEndingWithUnderscoreAt
    | undefined
    ? Date
    : WorkflowListItemFromAPI[Key];
};

type ListWorkflowsFilters = {
  limit: number;
  state?: WorkflowState;
};

type WorkflowListItemFromAPI = {
  count_available: number;
  count_cancelled: number;
  count_completed: number;
  count_discarded: number;
  count_failed_deps: number;
  count_pending: number;
  count_retryable: number;
  count_running: number;
  count_scheduled: number;
  created_at: string;
  id: string;
  name: null | string;
};

export const listWorkflowsKey = (
  args: ListWorkflowsFilters,
): ListWorkflowsKey => {
  return ["listWorkflows", args.state, args.limit];
};

export const listWorkflows: QueryFunction<
  WorkflowListItem[],
  ListWorkflowsKey
> = async ({ queryKey, signal }) => {
  const [, state, limit] = queryKey;
  const query = new URLSearchParams({ limit: limit.toString() });
  if (state) {
    query.set("state", state);
  }

  return API.get<ListResponse<WorkflowListItemFromAPI>>(
    { path: "/pro/workflows", query },
    { signal },
  ).then(
    // Map from WorkflowListItemFromAPI to WorkflowListItem:
    // TODO: there must be a cleaner way to do this given the type definitions?
    (response) => response.data.map(apiWorkflowListItemToWorkflowListItem),
  );
};

export const apiWorkflowListItemToWorkflowListItem = (
  workflow: WorkflowListItemFromAPI,
): WorkflowListItem => ({
  countAvailable: workflow.count_available,
  countCancelled: workflow.count_cancelled,
  countCompleted: workflow.count_completed,
  countDiscarded: workflow.count_discarded,
  countFailedDeps: workflow.count_failed_deps,
  countPending: workflow.count_pending,
  countRetryable: workflow.count_retryable,
  countRunning: workflow.count_running,
  countScheduled: workflow.count_scheduled,
  createdAt: new Date(workflow.created_at),
  id: workflow.id,
  name: workflow.name,
});
