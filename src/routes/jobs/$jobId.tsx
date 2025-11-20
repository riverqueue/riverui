import JobDetail from "@components/JobDetail";
import JobNotFound from "@components/JobNotFound";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import {
  cancelJobs,
  deleteJobs,
  getJob,
  getJobKey,
  retryJobs,
} from "@services/jobs";
import { toastError, toastSuccess } from "@services/toast";
import { JobState } from "@services/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  ErrorComponent,
  getRouteApi,
} from "@tanstack/react-router";
import { NotFoundError } from "@utils/api";

const routeApi = getRouteApi("/jobs/$jobId");

export const Route = createFileRoute("/jobs/$jobId")({
  parseParams: ({ jobId }) => ({ jobId: BigInt(jobId) }),
  stringifyParams: ({ jobId }) => ({ jobId: `${jobId}` }),

  beforeLoad: ({ abortController, params: { jobId } }) => {
    return {
      queryOptions: {
        queryKey: getJobKey(jobId),
        queryFn: getJob,
        refetchInterval: 2000,
        signal: abortController.signal,
      },
    };
  },

  loader: async ({ context: { queryClient, queryOptions } }) => {
    await queryClient.ensureQueryData(queryOptions);
  },

  errorComponent: ({ error }) => {
    const { jobId } = routeApi.useParams();
    if (error instanceof NotFoundError) {
      return <JobNotFound jobId={jobId} />;
    }

    return <ErrorComponent error={error} />;
  },

  component: JobComponent,
});

function JobComponent() {
  const { jobId } = Route.useParams();
  const navigate = Route.useNavigate();
  const { queryOptions } = Route.useRouteContext();
  const refreshSettings = useRefreshSetting();
  queryOptions.refetchInterval = refreshSettings.intervalMs;

  const queryClient = useQueryClient();
  const jobQuery = useQuery(queryOptions);

  const cancelMutation = useMutation<void, Error, void>({
    mutationFn: async (_variables, context) =>
      cancelJobs({ ids: [jobId] }, context),
    throwOnError: true,
    onSuccess: () => {
      toastError({
        message: "Job cancelled",
        duration: 2000,
      });
      return queryClient.invalidateQueries({
        queryKey: queryOptions.queryKey,
      });
    },
  });

  const deleteMutation = useMutation<void, Error, void>({
    mutationFn: async (_variables, context) =>
      deleteJobs({ ids: [jobId] }, context),
    throwOnError: true,
    onSuccess: async () => {
      toastError({
        message: "Job deleted",
        duration: 2000,
      });
      await navigate({ to: "/jobs", search: { state: JobState.Running } });
      await queryClient.removeQueries({
        queryKey: queryOptions.queryKey,
      });
    },
  });

  const retryMutation = useMutation<void, Error, void>({
    mutationFn: async (_variables, context) =>
      retryJobs({ ids: [jobId] }, context),
    throwOnError: true,
    onSuccess: () => {
      toastSuccess({
        message: "Job enqueued for retry",
        duration: 2000,
      });

      return queryClient.invalidateQueries({
        queryKey: queryOptions.queryKey,
      });
    },
  });

  if (jobQuery.isLoading || !jobQuery.data) {
    return <h4>loading…</h4>;
  }

  const { data: job } = jobQuery;

  return (
    <JobDetail
      cancel={cancelMutation.mutate}
      deleteFn={deleteMutation.mutate}
      job={job}
      retry={retryMutation.mutate}
    />
  );
}
