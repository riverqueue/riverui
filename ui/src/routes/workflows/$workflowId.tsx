import { ErrorComponent, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { NotFoundError } from "@utils/api";
import { getWorkflow, getWorkflowKey } from "@services/workflows";
import WorkflowDetail from "@components/WorkflowDetail";

export const Route = createFileRoute("/workflows/$workflowId")({
  parseParams: ({ workflowId }) => ({ workflowId }),
  stringifyParams: ({ workflowId }) => ({ workflowId }),

  beforeLoad: ({ abortController, params: { workflowId } }) => {
    return {
      queryOptions: {
        queryKey: getWorkflowKey(workflowId),
        queryFn: getWorkflow,
        refetchInterval: 1000,
        signal: abortController.signal,
      },
    };
  },

  loader: async ({ context: { queryClient, queryOptions } }) => {
    await queryClient.ensureQueryData(queryOptions);
  },

  errorComponent: ({ error }) => {
    if (error instanceof NotFoundError) {
      return <div>{error.message}</div>;
    }

    return <ErrorComponent error={error} />;
  },

  component: WorkflowComponent,
});

function WorkflowComponent() {
  const { queryOptions } = Route.useRouteContext();
  const refreshSettings = useRefreshSetting();
  queryOptions.refetchInterval = refreshSettings.intervalMs;

  const workflowQuery = useQuery(queryOptions);

  if (workflowQuery.isLoading || !workflowQuery.data) {
    return <h4>loading…</h4>;
  }

  const { data: workflow } = workflowQuery;

  if (!workflow) {
    return <p>Workflow not found.</p>;
  }

  return <WorkflowDetail workflow={workflow} />;
}
