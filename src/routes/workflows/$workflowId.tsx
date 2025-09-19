import WorkflowDetail from "@components/WorkflowDetail";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { toastSuccess } from "@services/toast";
import {
  cancelJobs,
  getWorkflow,
  getWorkflowKey,
  retryWorkflow,
  type WorkflowRetryMode,
} from "@services/workflows";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  queryOptions.refetchInterval = refreshSettings.intervalMs;

  const workflowQuery = useQuery(queryOptions);

  const { data: workflow } = workflowQuery;
  const setSelectedJobId = (jobId: bigint | undefined) => {
    navigate({
      replace: true,
      search: (prev) => ({ ...prev, selected: jobId }),
    });
  };

  const workflowID = workflow?.tasks?.[0]?.metadata.workflow_id;
  const cancelMutation = useMutation({
    mutationFn: cancelJobs,
    onSuccess: () => {
      if (workflowID) {
        queryClient.invalidateQueries({ queryKey: getWorkflowKey(workflowID) });
      }
      queryClient.invalidateQueries({ queryKey: ["listWorkflows"] });
      toastSuccess({
        message: "Workflow cancellation requested",
        duration: 2000,
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: retryWorkflow,
    onSuccess: () => {
      if (workflowID) {
        queryClient.invalidateQueries({ queryKey: getWorkflowKey(workflowID) });
      }
      queryClient.invalidateQueries({ queryKey: ["listWorkflows"] });
      toastSuccess({
        message: "Workflow retry requested",
        duration: 2000,
      });
    },
  });

  return (
    <WorkflowDetail
      cancelPending={cancelMutation.isPending}
      loading={workflowQuery.isLoading}
      onCancel={() =>
        workflowID && cancelMutation.mutate({ workflowID: String(workflowID) })
      }
      onRetry={(mode: WorkflowRetryMode, resetHistory: boolean) =>
        workflowID &&
        retryMutation.mutate({
          workflowID: String(workflowID),
          mode,
          resetHistory,
        })
      }
      retryPending={retryMutation.isPending}
      selectedJobId={selectedJobId}
      setSelectedJobId={setSelectedJobId}
      workflow={workflow}
    />
  );
}
