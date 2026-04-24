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
  hasMore: boolean;
  nextCursorID?: bigint;
  scope: WorkflowTaskSignalScope;
  signals: WorkflowTaskSignal[];
};

export type WorkflowTaskSignalReadScope =
  | ""
  | "at_wait_result"
  | "current_attempt";

export type WorkflowTaskSignalScope = {
  attempt: number;
  scope: WorkflowTaskSignalReadScope;
};

export type WorkflowTaskWait = {
  asOf?: Date;
  attempt?: number;
  exprCel: string;
  phase: WorkflowTaskWaitPhase;
  resolvedAt?: Date;
  signals: WorkflowTaskWaitSignal[];
  startedAt?: Date;
  summary?: string;
  terms: WorkflowTaskWaitTerm[];
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

export type WorkflowTaskWaitSignal = {
  key: string;
  lastMatchedID?: bigint;
  lastVisibleID?: bigint;
  matched: boolean;
  matchedCount: number;
  visibleCount: number;
};

export type WorkflowTaskWaitTerm = {
  exprCel?: string;
  kind: string;
  label: string;
  matched: boolean;
  name: string;
};

export type WorkflowTaskWaitTimer = {
  after?: string;
  afterSeconds?: number;
  afterUs?: number;
  anchor?: WorkflowTaskWaitTimerAnchor;
  fireAt?: Date;
  fired: boolean;
  matched: boolean;
  name: string;
};

export type WorkflowTaskWaitTimerAnchor = {
  kind: string;
  task?: string;
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
  has_more: boolean;
  next_cursor_id?: number | string;
  scope: WorkflowTaskSignalScopeFromAPI;
  signals: WorkflowTaskSignalFromAPI[];
};

type WorkflowTaskSignalScopeFromAPI = {
  attempt: number;
  scope: WorkflowTaskSignalReadScope;
};

type WorkflowTaskWaitFromAPI = {
  as_of?: string;
  attempt?: number;
  expr_cel: string;
  phase: string;
  resolved_at?: string;
  signals: WorkflowTaskWaitSignalFromAPI[];
  started_at?: string;
  summary?: string;
  terms: WorkflowTaskWaitTermFromAPI[];
  timers: WorkflowTaskWaitTimerFromAPI[];
};

type WorkflowTaskWaitReasonFromAPI = WorkflowTaskWaitReason;

type WorkflowTaskWaitSignalFromAPI = {
  key: string;
  last_matched_id?: number | string;
  last_visible_id?: number | string;
  matched: boolean;
  matched_count: number;
  visible_count: number;
};

type WorkflowTaskWaitTermFromAPI = {
  expr_cel?: string;
  kind: string;
  label: string;
  matched: boolean;
  name: string;
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
  fired: boolean;
  matched: boolean;
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
  scope?: Exclude<WorkflowTaskSignalReadScope, "">;
  signal?: AbortSignal;
  taskName: string;
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

  return API.get<WorkflowTaskSignalListFromAPI>(
    { path: `/pro/workflows/${workflowID}/task-signals`, query },
    { signal },
  ).then(apiWorkflowTaskSignalListToWorkflowTaskSignalList);
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

  return {
    asOf: parseDate(wait.as_of),
    attempt: wait.attempt,
    exprCel: wait.expr_cel,
    phase: parseWorkflowTaskWaitPhase(wait.phase),
    resolvedAt: parseDate(wait.resolved_at),
    signals: wait.signals.map(
      apiWorkflowTaskWaitSignalToWorkflowTaskWaitSignal,
    ),
    startedAt: parseDate(wait.started_at),
    summary: wait.summary,
    terms: wait.terms.map(apiWorkflowTaskWaitTermToWorkflowTaskWaitTerm),
    timers: wait.timers.map(apiWorkflowTaskWaitTimerToWorkflowTaskWaitTimer),
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
  matched: term.matched,
  name: term.name,
});

const apiWorkflowTaskWaitSignalToWorkflowTaskWaitSignal = (
  signal: WorkflowTaskWaitSignalFromAPI,
): WorkflowTaskWaitSignal => ({
  key: signal.key,
  lastMatchedID: parseBigInt(signal.last_matched_id),
  lastVisibleID: parseBigInt(signal.last_visible_id),
  matched: signal.matched,
  matchedCount: signal.matched_count,
  visibleCount: signal.visible_count,
});

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
    fired: timer.fired,
    matched: timer.matched,
    name: timer.name,
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
  hasMore: signalList.has_more,
  nextCursorID: parseBigInt(signalList.next_cursor_id),
  scope: apiWorkflowTaskSignalScopeToWorkflowTaskSignalScope(signalList.scope),
  signals: signalList.signals.map(apiWorkflowTaskSignalToWorkflowTaskSignal),
});

const apiWorkflowTaskSignalScopeToWorkflowTaskSignalScope = (
  scope: WorkflowTaskSignalScopeFromAPI,
): WorkflowTaskSignalScope => ({
  attempt: scope.attempt,
  scope: parseWorkflowTaskSignalReadScope(scope.scope),
});

const parseWorkflowTaskSignalReadScope = (
  scope: unknown,
): WorkflowTaskSignalReadScope => {
  if (
    scope === "" ||
    scope === "at_wait_result" ||
    scope === "current_attempt"
  ) {
    return scope;
  }

  return "";
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
