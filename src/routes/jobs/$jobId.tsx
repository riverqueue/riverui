import JobDetail from "@components/JobDetail";
import JobNotFound from "@components/JobNotFound";
import { useFeatures } from "@contexts/Features.hook";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { refreshQueryOptions } from "@contexts/RefreshSettings.query";
import { useRetryJobs } from "@hooks/use-retry-jobs";
import { cancelJobs, deleteJobs, getJob, getJobKey } from "@services/jobs";
import {
  getJobSequence,
  jobSequenceKey,
  sequenceKeyFromMetadata,
  sequenceKeyPrefix,
} from "@services/sequences";
import { toastError } from "@services/toast";
import { JobState } from "@services/types";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createFileRoute,
  ErrorComponent,
  getRouteApi,
} from "@tanstack/react-router";
import { NotFoundError } from "@utils/api";
import { useMemo } from "react";

const routeApi = getRouteApi("/jobs/$jobId");

export const Route = createFileRoute("/jobs/$jobId")({
  parseParams: ({ jobId }) => ({ jobId: BigInt(jobId) }),
  stringifyParams: ({ jobId }) => ({ jobId: `${jobId}` }),

  beforeLoad: ({ abortController, params: { jobId } }) => {
    return {
      queryOptions: {
        queryKey: getJobKey(jobId),
        queryFn: getJob,
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

export function JobComponent() {
  const { jobId } = Route.useParams();
  const navigate = Route.useNavigate();
  const { queryOptions } = Route.useRouteContext();
  const refreshSettings = useRefreshSetting();
  const queryOptionsWithRefresh = useMemo(
    () => ({
      ...queryOptions,
      ...refreshQueryOptions(refreshSettings.intervalMs),
    }),
    [queryOptions, refreshSettings.intervalMs],
  );

  const queryClient = useQueryClient();
  const jobQuery = useQuery(queryOptionsWithRefresh);
  const { features } = useFeatures();
  const sequenceKey = jobQuery.data
    ? sequenceKeyFromMetadata(jobQuery.data.metadata)
    : undefined;
  const sequenceEnabled = features.sequenceQueries && !!sequenceKey;
  const jobState = jobQuery.data?.state;
  // Only a pending job's wait reason changes while the job itself doesn't, so
  // other jobs load their sequence once per job state instead of polling it.
  // A halting job's own state changes when it's retried, which reloads it.
  const sequenceRefresh = refreshQueryOptions(
    jobState === JobState.Pending ? refreshSettings.intervalMs : 0,
  );
  const sequenceQuery = useQuery({
    enabled: sequenceEnabled,
    queryFn: getJobSequence,
    queryKey: jobSequenceKey(jobId, jobState),
    ...sequenceRefresh,
    // Avoid flashing the field empty while a new state's snapshot loads.
    placeholderData: keepPreviousData,
    staleTime: sequenceRefresh.refetchInterval === false ? Infinity : 0,
  });

  const invalidateJob = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryOptionsWithRefresh.queryKey,
      }),
      queryClient.invalidateQueries({ queryKey: jobSequenceKey(jobId) }),
      // A cached sequence page shows this job too.
      sequenceKey &&
        queryClient.invalidateQueries({
          queryKey: sequenceKeyPrefix(sequenceKey),
        }),
    ]);

  const cancelMutation = useMutation<void, Error, void>({
    mutationFn: async (_variables, context) =>
      cancelJobs({ ids: [jobId] }, context),
    throwOnError: true,
    onSuccess: () => {
      toastError({
        message: "Job cancelled",
        duration: 2000,
      });
      return invalidateJob();
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
        queryKey: queryOptionsWithRefresh.queryKey,
      });
    },
  });

  const retryMutation = useRetryJobs({
    onSuccess: invalidateJob,
    successMessage: "Job enqueued for retry",
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
      retry={() => retryMutation.mutate([jobId])}
      sequence={
        sequenceEnabled && sequenceKey
          ? {
              error: sequenceQuery.isError,
              jobSequence: sequenceQuery.data,
              key: sequenceKey,
            }
          : undefined
      }
    />
  );
}
