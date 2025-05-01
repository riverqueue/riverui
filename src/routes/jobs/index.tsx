import { Filter, FilterTypeId } from "@components/job-search/JobSearch";
import JobList from "@components/JobList";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import {
  cancelJobs,
  deleteJobs,
  Job,
  listJobs,
  ListJobsKey,
  listJobsKey,
  retryJobs,
} from "@services/jobs";
import { countsByState, countsByStateKey } from "@services/states";
import { toastError, toastSuccess } from "@services/toast";
import { JobState } from "@services/types";
import {
  PlaceholderDataFunction,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";

const minimumLimit = 20;
const defaultLimit = 20;
const maximumLimit = 200;

const jobSearchSchema = z.object({
  kind: z.string().optional(),
  limit: z
    .number()
    .int()
    .min(minimumLimit)
    .max(maximumLimit)
    .default(defaultLimit)
    .catch(defaultLimit)
    .optional(),
  priority: z.coerce.number().int().optional(),
  queue: z.string().optional(),
  state: z.nativeEnum(JobState).catch(JobState.Running),
});

export const Route = createFileRoute("/jobs/")({
  validateSearch: jobSearchSchema,
  beforeLoad: async ({ context, search }) => {
    if (!search.state) {
      throw redirect({
        from: Route.fullPath,
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
  loader: async ({ context: { queryClient }, deps: { limit, state } }) => {
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
  const { kind, priority, queue } = Route.useSearch();
  const refreshSettings = useRefreshSetting();
  const refetchInterval = refreshSettings.intervalMs;
  const [pauseRefetches, setJobRefetchesPaused] = useState(false);
  const queryClient = useQueryClient();

  const jobsQuery = useQuery(
    jobsQueryOptions(Route.useLoaderDeps(), {
      pauseRefetches,
      refetchInterval,
    }),
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

  const handleFiltersChange = useCallback(
    (filters: Filter[]) => {
      // Initialize all filterable params as undefined to ensure removal when not present
      const searchParams: Record<string, number | string | undefined> = {
        kind: undefined,
        priority: undefined,
        queue: undefined,
      };

      // Only set values for filters that exist and have values
      filters.forEach((filter) => {
        switch (filter.typeId) {
          case FilterTypeId.JOB_KIND:
            // For now, still only use first value as the API likely doesn't support multiple
            searchParams.kind =
              filter.values.length > 0 ? filter.values[0] : undefined;
            break;
          case FilterTypeId.PRIORITY:
            // Priority should only ever have one value
            searchParams.priority =
              filter.values.length > 0
                ? parseInt(filter.values[0], 10)
                : undefined;
            break;
          case FilterTypeId.QUEUE:
            // For queue, join multiple values with commas
            searchParams.queue =
              filter.values.length > 0 ? filter.values.join(",") : undefined;
            break;
        }
      });

      // Update route search params, preserving other existing ones
      navigate({
        replace: true,
        search: (old) => ({ ...old, ...searchParams }),
      });
    },
    [navigate],
  );

  // Convert current search params to initial filters
  const initialFilters = useMemo(() => {
    const filters: Filter[] = [];
    if (kind) {
      filters.push({
        id: "kind-filter",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: [kind],
      });
    }
    if (priority !== undefined) {
      filters.push({
        id: "priority-filter",
        prefix: "priority:",
        typeId: FilterTypeId.PRIORITY,
        values: [priority.toString()],
      });
    }
    if (queue) {
      filters.push({
        id: "queue-filter",
        prefix: "queue:",
        typeId: FilterTypeId.QUEUE,
        values: [queue],
      });
    }
    return filters;
  }, [kind, priority, queue]);

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
      cancelJobs={cancelMutation.mutate}
      canShowFewer={canShowFewer}
      canShowMore={canShowMore}
      deleteJobs={deleteMutation.mutate}
      initialFilters={initialFilters}
      jobs={jobsQuery.data || []}
      loading={jobsQuery.isLoading}
      onFiltersChange={handleFiltersChange}
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
  opts?: { pauseRefetches: boolean; refetchInterval: number },
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
