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
  gate?: WorkflowTaskGate;
  ignoreCancelledDeps: boolean;
  ignoreDeletedDeps: boolean;
  ignoreDiscardedDeps: boolean;
  name: string;
  stagedAt?: Date;
  waitReason: WorkflowTaskWaitReason;
  workflowID: string;
} & JobWithKnownMetadata;

export type WorkflowTaskGate = {
  activeAt?: Date;
  declaredSignals: string[];
  enabled: boolean;
  exprCel: string;
  phase: WorkflowTaskGatePhase;
  satisfaction?: WorkflowTaskGateSatisfaction;
  satisfiedAt?: Date;
  timers: WorkflowTaskGateTimer[];
};

export type WorkflowTaskGatePhase =
  | "inactive"
  | "satisfied"
  | "unknown"
  | "waiting";

export type WorkflowTaskGateSatisfaction = {
  asOf: Date;
  attempt: number;
  signals: WorkflowTaskGateSatisfactionSignal[];
  timers: WorkflowTaskGateSatisfactionTimer[];
};

export type WorkflowTaskGateSatisfactionSignal = {
  count: number;
  key: string;
  lastSignalId?: bigint;
};

export type WorkflowTaskGateSatisfactionTimer = {
  fireAt?: Date;
  fired: boolean;
  name: string;
};

export type WorkflowTaskGateTimer = {
  after?: string;
  afterSeconds?: number;
  afterUs?: number;
  anchor?: WorkflowTaskGateTimerAnchor;
  fireAt?: Date;
  hasAfter: boolean;
  hasFireAt: boolean;
  name: string;
};

export type WorkflowTaskGateTimerAnchor = {
  kind: string;
  task?: string;
};

export type WorkflowTaskWaitReason =
  | "dependencies_and_gate"
  | "dependencies"
  | "gate"
  | "none";

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
  gate?: WorkflowTaskGateFromAPI;
  ignore_cancelled_deps: boolean;
  ignore_deleted_deps: boolean;
  ignore_discarded_deps: boolean;
  name: string;
  staged_at?: string;
  wait_reason: WorkflowTaskWaitReasonFromAPI;
  workflow_id: string;
} & JobFromAPI;

type WorkflowTaskGateFromAPI = {
  active_at?: string;
  declared_signals: string[];
  enabled: boolean;
  expr_cel: string;
  phase: string;
  satisfaction?: WorkflowTaskGateSatisfactionFromAPI;
  satisfied_at?: string;
  timers: WorkflowTaskGateTimerFromAPI[];
};

type WorkflowTaskGateSatisfactionFromAPI = {
  as_of: string;
  attempt: number;
  signals: WorkflowTaskGateSatisfactionSignalFromAPI[];
  timers: WorkflowTaskGateSatisfactionTimerFromAPI[];
};

type WorkflowTaskGateSatisfactionSignalFromAPI = {
  count: number;
  key: string;
  last_signal_id: number | string;
};

type WorkflowTaskGateSatisfactionTimerFromAPI = {
  fire_at?: string;
  fired: boolean;
  name: string;
};

type WorkflowTaskGateTimerAnchorFromAPI = {
  kind: string;
  task?: string;
};

type WorkflowTaskGateTimerFromAPI = {
  after?: string;
  after_seconds?: number;
  after_us?: number;
  anchor?: WorkflowTaskGateTimerAnchorFromAPI;
  fire_at?: string;
  has_after: boolean;
  has_fire_at: boolean;
  name: string;
};

type WorkflowTaskWaitReasonFromAPI = WorkflowTaskWaitReason;

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
    gate: apiWorkflowTaskGateToWorkflowTaskGate(taskFromAPI.gate),
    ignoreCancelledDeps: taskFromAPI.ignore_cancelled_deps,
    ignoreDeletedDeps: taskFromAPI.ignore_deleted_deps,
    ignoreDiscardedDeps: taskFromAPI.ignore_discarded_deps,
    name: taskFromAPI.name,
    stagedAt: parseDate(taskFromAPI.staged_at),
    waitReason: taskFromAPI.wait_reason,
    workflowID: taskFromAPI.workflow_id,
  };
};

const apiWorkflowTaskGateToWorkflowTaskGate = (
  gate: undefined | WorkflowTaskGateFromAPI,
): undefined | WorkflowTaskGate => {
  if (!gate) return undefined;

  return {
    activeAt: parseDate(gate.active_at),
    declaredSignals: gate.declared_signals,
    enabled: gate.enabled,
    exprCel: gate.expr_cel,
    phase: parseWorkflowTaskGatePhase(gate.phase),
    satisfaction: apiWorkflowTaskGateSatisfactionToWorkflowTaskGateSatisfaction(
      gate.satisfaction,
    ),
    satisfiedAt: parseDate(gate.satisfied_at),
    timers: gate.timers.map(apiWorkflowTaskGateTimerToWorkflowTaskGateTimer),
  };
};

const parseWorkflowTaskGatePhase = (phase: unknown): WorkflowTaskGatePhase => {
  if (phase === "inactive" || phase === "waiting" || phase === "satisfied") {
    return phase;
  }

  return "unknown";
};

const apiWorkflowTaskGateTimerToWorkflowTaskGateTimer = (
  timer: WorkflowTaskGateTimerFromAPI,
): WorkflowTaskGateTimer => {
  return {
    after: timer.after,
    afterSeconds: timer.after_seconds,
    afterUs: timer.after_us,
    anchor: apiWorkflowTaskGateTimerAnchorToWorkflowTaskGateTimerAnchor(
      timer.anchor,
    ),
    fireAt: parseDate(timer.fire_at),
    hasAfter: timer.has_after,
    hasFireAt: timer.has_fire_at,
    name: timer.name,
  };
};

const apiWorkflowTaskGateTimerAnchorToWorkflowTaskGateTimerAnchor = (
  anchor: undefined | WorkflowTaskGateTimerAnchorFromAPI,
): undefined | WorkflowTaskGateTimerAnchor => {
  if (!anchor || !anchor.kind) return undefined;

  return {
    kind: anchor.kind,
    task: anchor.task,
  };
};

const apiWorkflowTaskGateSatisfactionToWorkflowTaskGateSatisfaction = (
  satisfaction: undefined | WorkflowTaskGateSatisfactionFromAPI,
): undefined | WorkflowTaskGateSatisfaction => {
  if (!satisfaction) {
    return undefined;
  }

  const asOf = parseDate(satisfaction.as_of);
  if (!asOf) return undefined;

  return {
    asOf,
    attempt: satisfaction.attempt,
    signals: satisfaction.signals.map(
      apiWorkflowTaskGateSatisfactionSignalToWorkflowTaskGateSatisfactionSignal,
    ),
    timers: satisfaction.timers.map(
      apiWorkflowTaskGateSatisfactionTimerToWorkflowTaskGateSatisfactionTimer,
    ),
  };
};

const apiWorkflowTaskGateSatisfactionSignalToWorkflowTaskGateSatisfactionSignal =
  (
    signal: WorkflowTaskGateSatisfactionSignalFromAPI,
  ): WorkflowTaskGateSatisfactionSignal => {
    return {
      count: signal.count,
      key: signal.key,
      lastSignalId: parseBigInt(signal.last_signal_id),
    };
  };

const apiWorkflowTaskGateSatisfactionTimerToWorkflowTaskGateSatisfactionTimer =
  (
    timer: WorkflowTaskGateSatisfactionTimerFromAPI,
  ): WorkflowTaskGateSatisfactionTimer => {
    return {
      fireAt: parseDate(timer.fire_at),
      fired: timer.fired,
      name: timer.name,
    };
  };

const parseDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
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
