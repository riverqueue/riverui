import WorkflowList from "@components/WorkflowList";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { WorkflowState } from "@services/types";
import { listWorkflows, listWorkflowsKey } from "@services/workflows";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

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
  beforeLoad: ({ context: { features }, search: { limit, state } }) => {
    return {
      workflowsQueryOptions: workflowsQueryOptions({
        enabled: features.workflowQueries,
        limit: limit || defaultLimit,
        state,
      }),
    };
  },
  loaderDeps: ({ search: { limit, state } }) => {
    return { limit: limit || defaultLimit, state };
  },
  loader: async ({ context: { queryClient, workflowsQueryOptions } }) => {
    if (!workflowsQueryOptions.enabled) return [];
    // TODO: how to pass abortController.signal into ensureQueryData or queryOptions?
    // signal: abortController.signal,
    return await queryClient.ensureQueryData(workflowsQueryOptions);
  },
  component: WorkflowsIndexComponent,
});

function WorkflowsIndexComponent() {
  const refreshSettings = useRefreshSetting();
  const refetchInterval = refreshSettings.intervalMs;
  const { workflowsQueryOptions } = Route.useRouteContext();
  const loaderDeps = Route.useLoaderDeps();
  const workflowsQuery = useQuery({
    ...workflowsQueryOptions,
    refetchInterval,
  });

  return (
    <WorkflowList
      loading={workflowsQuery.isLoading}
      showingAll={!loaderDeps.state}
      workflowItems={workflowsQuery.data || []}
    />
  );
}

const workflowsQueryOptions = ({
  enabled,
  limit,
  state,
}: {
  enabled: boolean;
  limit: number;
  state?: WorkflowState;
}) => {
  return queryOptions({
    enabled,
    queryKey: listWorkflowsKey({ limit, state }),
    queryFn: listWorkflows,
  });
};
