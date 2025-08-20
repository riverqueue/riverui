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
  tasks: JobWithKnownMetadata[];
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
  tasks: JobFromAPI[];
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

const apiWorkflowToWorkflow = (job: WorkflowFromAPI): Workflow => ({
  tasks: job.tasks.map(apiJobToJob) as JobWithKnownMetadata[],
});

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
