import { z } from "zod";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { WorkflowState } from "@services/types";

import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { createFileRoute } from "@tanstack/react-router";
import { listWorkflows, listWorkflowsKey } from "@services/workflows";
import WorkflowList from "@components/WorkflowList";

const minimumLimit = 20;
const defaultLimit = 100;
const maximumLimit = 200;

const workflowSearchSchema = z.object({
  limit: z
    .number()
    .int()
    .min(minimumLimit)
    .max(maximumLimit)
    .default(defaultLimit)
    .catch(defaultLimit)
    .optional(),
  state: z.nativeEnum(WorkflowState).optional().catch(undefined),
});

export const Route = createFileRoute("/workflows/")({
  validateSearch: workflowSearchSchema,
  loaderDeps: ({ search: { limit, state } }) => {
    return { limit: limit || defaultLimit, state };
  },
  loader: async ({ context, deps: { limit, state } }) => {
    const { queryClient } = context;
    // TODO: how to pass abortController.signal into ensureQueryData or queryOptions?
    // signal: abortController.signal,
    return await queryClient.ensureQueryData({
      ...workflowsQueryOptions({ limit, state }),
    });
  },
  component: WorkflowsIndexComponent,
});

function WorkflowsIndexComponent() {
  const refreshSettings = useRefreshSetting();
  const refetchInterval = refreshSettings.intervalMs;
  const loaderDeps = Route.useLoaderDeps();
  const workflowsQuery = useQuery(
    workflowsQueryOptions(loaderDeps, { refetchInterval }),
  );

  return (
    <WorkflowList
      loading={workflowsQuery.isLoading}
      showingAll={!loaderDeps.state}
      workflowItems={workflowsQuery.data || []}
    />
  );
}

const workflowsQueryOptions = (
  {
    limit,
    state,
  }: {
    limit: number;
    state?: WorkflowState;
  },
  opts?: { refetchInterval: number },
) => {
  return queryOptions({
    queryKey: listWorkflowsKey({ limit, state }),
    queryFn: listWorkflows,
    refetchInterval: opts?.refetchInterval,
  });
};
