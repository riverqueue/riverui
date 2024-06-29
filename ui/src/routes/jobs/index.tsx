import { z } from "zod";
import {
  PlaceholderDataFunction,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { JobState } from "@services/types";
import JobList from "@components/JobList";
import {
  Job,
  ListJobsKey,
  cancelJobs,
  deleteJobs,
  listJobs,
  listJobsKey,
  retryJobs,
} from "@services/jobs";

import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { countsByState, countsByStateKey } from "@services/states";
import { useState } from "react";
import { toastError, toastSuccess } from "@services/toast";

const minimumLimit = 20;
const defaultLimit = 20;
const maximumLimit = 200;

const jobSearchSchema = z.object({
  limit: z
    .number()
    .int()
    .min(minimumLimit)
    .max(maximumLimit)
    .default(defaultLimit)
    .catch(defaultLimit)
    .optional(),
  state: z.nativeEnum(JobState).catch(JobState.Running),
});

export const Route = createFileRoute("/jobs/")({
  validateSearch: jobSearchSchema,
  beforeLoad: async ({ context, search }) => {
    if (!search.state) {
      throw redirect({
        replace: true,
        search: {
          state: JobState.Running,
        },
      });
    }
    return context;
  },
  loaderDeps: ({ search: { limit, state } }) => {
    return { limit: limit || minimumLimit, state };
  },
  loader: async ({ context, deps: { limit, state } }) => {
    if (!context) {
      // workaround for this issue:
      // https://github.com/TanStack/router/issues/1751
      return;
    }
    const { queryClient } = context;
    // TODO: how to pass abortController.signal into ensureQueryData or queryOptions?
    // signal: abortController.signal,
    await Promise.all([
      queryClient.ensureQueryData({ ...jobsQueryOptions({ limit, state }) }),
      queryClient.ensureQueryData(statesQueryOptions()),
    ]);
  },

  component: JobsIndexComponent,
});

function JobsIndexComponent() {
  const navigate = Route.useNavigate();
  const { limit, state } = Route.useLoaderDeps();
  const refreshSettings = useRefreshSetting();
  const refetchInterval = refreshSettings.intervalMs;
  const [pauseRefetches, setJobRefetchesPaused] = useState(false);
  const queryClient = useQueryClient();

  const jobsQuery = useQuery(
    jobsQueryOptions(Route.useLoaderDeps(), { pauseRefetches, refetchInterval })
  );
  const statesQuery = useQuery(statesQueryOptions({ refetchInterval }));

  const canShowFewer = limit > minimumLimit;
  const canShowMore = limit < maximumLimit;

  const showFewer = () => {
    const newLimitCalculated = Math.max(limit - 20, minimumLimit);
    const newLimit =
      newLimitCalculated === defaultLimit ? undefined : newLimitCalculated;
    navigate({
      replace: true,
      search: (old) => ({ ...old, limit: newLimit }),
    });
  };
  const showMore = () => {
    navigate({
      replace: true,
      search: (old) => ({ ...old, limit: Math.min(limit + 20, maximumLimit) }),
    });
  };

  const cancelMutation = useMutation({
    mutationFn: async (jobIDs: bigint[]) => cancelJobs({ ids: jobIDs }),
    throwOnError: true,
    onSuccess: () => {
      toastError({
        message: "Jobs cancelled",
        duration: 2000,
      });
      queryClient.invalidateQueries({
        queryKey: listJobsKey({ limit, state }),
      });
      queryClient.invalidateQueries({ queryKey: countsByStateKey() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (jobIDs: bigint[]) => deleteJobs({ ids: jobIDs }),
    throwOnError: true,
    onSuccess: async () => {
      toastError({
        message: "Jobs deleted",
        duration: 2000,
      });
      await queryClient.removeQueries({
        queryKey: listJobsKey({ limit, state }),
      });
      queryClient.invalidateQueries({ queryKey: countsByStateKey() });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (jobIDs: bigint[]) => retryJobs({ ids: jobIDs }),
    throwOnError: true,
    onSuccess: () => {
      toastSuccess({
        message: "Jobs enqueued for retry",
        duration: 2000,
      });
      queryClient.invalidateQueries({
        queryKey: listJobsKey({ limit, state }),
      });
      queryClient.invalidateQueries({ queryKey: countsByStateKey() });
    },
  });

  return (
    <JobList
      canShowFewer={canShowFewer}
      canShowMore={canShowMore}
      cancelJobs={cancelMutation.mutate}
      deleteJobs={deleteMutation.mutate}
      jobs={jobsQuery.data || []}
      loading={jobsQuery.isLoading}
      retryJobs={retryMutation.mutate}
      setJobRefetchesPaused={setJobRefetchesPaused}
      showFewer={showFewer}
      showMore={showMore}
      state={state}
      statesAndCounts={statesQuery.data}
    />
  );
}

const jobsQueryOptions = (
  {
    limit,
    state,
  }: {
    limit: number;
    state: JobState;
  },
  opts?: { pauseRefetches: boolean; refetchInterval: number }
) => {
  const keepPreviousDataUnlessStateChanged: PlaceholderDataFunction<
    Job[],
    Error,
    Job[],
    ListJobsKey
  > = (previousData, previousQuery) => {
    if (!previousQuery) return undefined;
    const [, previousState] = previousQuery.queryKey;
    if (previousState !== state) return undefined;
    return previousData;
  };
  return queryOptions({
    queryKey: listJobsKey({ limit, state }),
    queryFn: listJobs,
    placeholderData: keepPreviousDataUnlessStateChanged,
    refetchInterval: !opts?.pauseRefetches && opts?.refetchInterval,
  });
};

const statesQueryOptions = (opts?: { refetchInterval: number }) =>
  queryOptions({
    queryKey: countsByStateKey(),
    queryFn: countsByState,
    refetchInterval: opts?.refetchInterval,
  });
