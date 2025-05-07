import { Filter, FilterTypeId } from "@components/job-search/JobSearch";
import JobList from "@components/JobList";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { defaultValues, jobSearchSchema } from "@routes/jobs/index.schema";
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
import {
  createFileRoute,
  retainSearchParams,
  stripSearchParams,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useCallback, useMemo, useState } from "react";

const minimumLimit = 20;
const defaultLimit = 20;
const maximumLimit = 200;

export const Route = createFileRoute("/jobs/")({
  validateSearch: zodValidator(jobSearchSchema),
  // Strip default values from URLs and retain important params across navigation
  search: {
    middlewares: [
      stripSearchParams(defaultValues),
      retainSearchParams(["id", "kind", "limit", "priority", "queue"]),
    ],
  },
  beforeLoad: async ({ context }) => {
    // No need to check for search.state since it has a default value now
    return context;
  },
  loaderDeps: ({ search: { limit, state, kind, queue, priority, id } }) => {
    return {
      kind,
      limit: limit || defaultValues.limit,
      priority: priority?.map((p) => parseInt(p, 10)),
      queue,
      state,
      id,
    };
  },
  loader: async ({
    context: { queryClient },
    deps: { limit, state, kind, queue, id },
  }) => {
    await Promise.all([
      queryClient.ensureQueryData({
        ...jobsQueryOptions({ limit, state, kind, queue, id }),
      }),
      queryClient.ensureQueryData(statesQueryOptions()),
    ]);
  },

  component: JobsIndexComponent,
});

function JobsIndexComponent() {
  const navigate = Route.useNavigate();
  const { id, limit, state, kind, queue, priority } = Route.useLoaderDeps();
  const refreshSettings = useRefreshSetting();
  const refetchInterval = refreshSettings.intervalMs;
  const [pauseRefetches, setJobRefetchesPaused] = useState(false);
  const queryClient = useQueryClient();

  const jobsQuery = useQuery(
    jobsQueryOptions(
      {
        id,
        limit,
        state,
        kind,
        queue,
        priority,
      },
      {
        pauseRefetches,
        refetchInterval,
      },
    ),
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
      search: (old) =>
        ({ ...old, limit: newLimit }) as {
          id?: string[];
          kind?: string[];
          limit: number;
          priority?: string[];
          queue?: string[];
          state: JobState;
        },
    });
  };
  const showMore = () => {
    navigate({
      replace: true,
      search: (old) =>
        ({ ...old, limit: Math.min(limit + 20, maximumLimit) }) as {
          id?: string[];
          kind?: string[];
          limit: number;
          priority?: string[];
          queue?: string[];
          state: JobState;
        },
    });
  };

  const handleFiltersChange = useCallback(
    (filters: Filter[]) => {
      // Initialize all filterable params as undefined to ensure removal when not present
      const searchParams: Record<string, string[] | undefined> = {
        kind: undefined,
        priority: undefined,
        queue: undefined,
        id: undefined,
      };

      // Only set values for filters that exist and have values
      filters.forEach((filter) => {
        switch (filter.typeId) {
          case FilterTypeId.ID:
            searchParams.id = filter.values.length ? filter.values : undefined;
            break;
          case FilterTypeId.KIND:
            searchParams.kind = filter.values.length
              ? filter.values
              : undefined;
            break;
          case FilterTypeId.PRIORITY:
            searchParams.priority = filter.values.length
              ? filter.values
              : undefined;
            break;
          case FilterTypeId.QUEUE:
            searchParams.queue = filter.values.length
              ? filter.values
              : undefined;
            break;
        }
      });

      // Update route search params, preserving other existing ones
      navigate({
        replace: true,
        search: (old) =>
          ({ ...old, ...searchParams }) as {
            id?: string[];
            kind?: string[];
            limit: number;
            priority?: string[];
            queue?: string[];
            state: JobState;
          },
      });
    },
    [navigate],
  );

  // Convert current search params to initial filters
  const initialFilters = useMemo(() => {
    const filters: Filter[] = [];
    if (id !== undefined) {
      filters.push({
        id: "id-filter",
        prefix: "id:",
        typeId: FilterTypeId.ID,
        values: id.map(String),
      });
    }
    if (kind?.length) {
      filters.push({
        id: "kind-filter",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: kind,
      });
    }
    if (priority !== undefined) {
      filters.push({
        id: "priority-filter",
        prefix: "priority:",
        typeId: FilterTypeId.PRIORITY,
        values: priority.map(String),
      });
    }
    if (queue?.length) {
      filters.push({
        id: "queue-filter",
        prefix: "queue:",
        typeId: FilterTypeId.QUEUE,
        values: queue,
      });
    }
    return filters;
  }, [id, kind, priority, queue]);

  const cancelMutation = useMutation({
    mutationFn: async (jobIDs: bigint[]) => cancelJobs({ ids: jobIDs }),
    throwOnError: true,
    onSuccess: () => {
      toastError({
        message: "Jobs cancelled",
        duration: 2000,
      });
      queryClient.invalidateQueries({
        queryKey: listJobsKey({
          limit,
          state,
          kinds: kind,
          queues: queue,
          priorities: priority,
          ids: id,
        }),
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
    id,
    limit,
    state,
    kind,
    queue,
    priority,
  }: {
    id?: bigint[];
    kind?: string[];
    limit: number;
    priority?: number[];
    queue?: string[];
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
    const [, previousParams] = previousQuery.queryKey;
    if (previousParams.state !== state) return undefined;
    return previousData;
  };
  return queryOptions({
    queryKey: listJobsKey({
      limit,
      state,
      kinds: kind,
      queues: queue,
      priorities: priority,
      ids: id,
    }),
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
