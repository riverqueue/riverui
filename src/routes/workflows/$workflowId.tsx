import WorkflowDetail from "@components/WorkflowDetail";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { getWorkflow, getWorkflowKey } from "@services/workflows";
import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  ErrorComponent,
  useNavigate,
} from "@tanstack/react-router";
import { NotFoundError } from "@utils/api";
import { z } from "zod";

const workflowDetailSearchSchema = z.object({
  selected: z.coerce.bigint().positive().optional(),
});

export const Route = createFileRoute("/workflows/$workflowId")({
  validateSearch: workflowDetailSearchSchema,
  parseParams: ({ workflowId }) => ({ workflowId }),
  stringifyParams: ({ workflowId }) => ({ workflowId }),

  beforeLoad: ({
    abortController,
    context: { features },
    params: { workflowId },
  }) => {
    return {
      queryOptions: {
        enabled: features.workflowQueries,
        queryKey: getWorkflowKey(workflowId),
        queryFn: getWorkflow,
        refetchInterval: 1000,
        signal: abortController.signal,
      },
    };
  },

  loader: async ({ context: { queryClient, queryOptions } }) => {
    if (!queryOptions.enabled) return;
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
  const { selected: selectedJobId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const refreshSettings = useRefreshSetting();
  queryOptions.refetchInterval = refreshSettings.intervalMs;

  const workflowQuery = useQuery(queryOptions);

  const { data: workflow } = workflowQuery;
  const setSelectedJobId = (jobId: bigint | undefined) => {
    navigate({
      replace: true,
      search: (prev) => ({ ...prev, selected: jobId }),
    });
  };

  return (
    <WorkflowDetail
      loading={workflowQuery.isLoading}
      selectedJobId={selectedJobId}
      setSelectedJobId={setSelectedJobId}
      workflow={workflow}
    />
  );
}
