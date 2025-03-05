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
  const { selected: selectedJobId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const refreshSettings = useRefreshSetting();
  queryOptions.refetchInterval = refreshSettings.intervalMs;

  const workflowQuery = useQuery(queryOptions);

  if (workflowQuery.isLoading || !workflowQuery.data) {
    return <h4>loading…</h4>;
  }

  const { data: workflow } = workflowQuery;
  const setSelectedJobId = (jobId: bigint | undefined) => {
    navigate({
      replace: true,
      search: (prev) => ({ ...prev, selected: jobId }),
    });
  };

  return (
    <WorkflowDetail
      selectedJobId={selectedJobId}
      setSelectedJobId={setSelectedJobId}
      workflow={workflow}
    />
  );
}
