import { ErrorComponent, createFileRoute } from "@tanstack/react-router";
import { cancelJobs, getJob, getJobKey, retryJobs } from "@services/jobs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import JobDetail from "@components/JobDetail";
import { NotFoundError } from "@utils/api";

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
    if (error instanceof NotFoundError) {
      return <div>{error.message}</div>;
    }

    return <ErrorComponent error={error} />;
  },

  component: JobComponent,
});

function JobComponent() {
  const { jobId } = Route.useParams();
  const { queryOptions } = Route.useRouteContext();
  const refreshSettings = useRefreshSetting();
  queryOptions.refetchInterval = refreshSettings.intervalMs;

  const queryClient = useQueryClient();
  const jobQuery = useQuery(queryOptions);

  const cancelMutation = useMutation({
    mutationFn: async () => cancelJobs({ ids: [jobId] }),
    throwOnError: true,
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: queryOptions.queryKey,
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async () => retryJobs({ ids: [jobId] }),
    throwOnError: true,
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: queryOptions.queryKey,
      });
    },
  });

  if (jobQuery.isLoading || !jobQuery.data) {
    return <h4>loading…</h4>;
  }

  const { data: job } = jobQuery;

  if (!job) {
    return <p>Job not found.</p>;
  }

  return (
    <JobDetail
      cancel={cancelMutation.mutate}
      job={job}
      retry={retryMutation.mutate}
    />
  );
}
