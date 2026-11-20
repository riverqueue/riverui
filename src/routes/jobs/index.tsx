import { Filter, FilterTypeId } from "@components/job-search/JobSearch";
import JobList from "@components/JobList";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import {
  type RefreshQueryOptions,
  refreshQueryOptions,
} from "@contexts/RefreshSettings.query";
import { useRetryJobs } from "@hooks/use-retry-jobs";
import {
  defaultValues,
  jobSearchSchema,
  retainedJobSearchKeys,
  SortOrder,
} from "@routes/jobs/index.schema";
import {
  cancelJobs,
  deleteJobs,
  JobMinimal,
  listJobs,
  ListJobsKey,
  listJobsKey,
} from "@services/jobs";
import { countsByState, countsByStateKey } from "@services/states";
import { toastError } from "@services/toast";
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
import { useCallback, useMemo, useState } from "react";

const minimumLimit = 20;
const defaultLimit = 20;
const maximumLimit = 200;

const areStringArraysEqual = (a?: string[], b?: string[]) => {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

export const Route = createFileRoute("/jobs/")({
  validateSearch: jobSearchSchema,
  // Strip default values from URLs and retain important params across navigation
  search: {
    middlewares: [
      stripSearchParams(defaultValues),
      retainSearchParams([...retainedJobSearchKeys]),
    ],
  },
  beforeLoad: async ({ context }) => {
    // No need to check for search.state since it has a default value now
    return context;
  },
  loaderDeps: ({
    search: {
      createdAfter,
      createdBefore,
      limit,
      state,
      kind,
      queue,
      priority,
      id,
      sortOrder,
      tags,
    },
  }) => {
    return {
      createdAfter,
      createdBefore,
      kind,
      limit: limit || defaultValues.limit,
      priority: priority?.map((p) => parseInt(p, 10)),
      queue,
      sortOrder,
      state,
      id,
      tags,
    };
  },
  loader: async ({
    context: { queryClient },
    deps: {
      createdAfter,
      createdBefore,
      limit,
      state,
      kind,
      queue,
      id,
      sortOrder,
      tags,
    },
  }) => {
    await Promise.all([
      queryClient.ensureQueryData({
        ...jobsQueryOptions({
          createdAfter,
          createdBefore,
          limit,
          state,
          kind,
          queue,
          id,
          sortOrder,
          tags,
        }),
      }),
      queryClient.ensureQueryData(statesQueryOptions()),
    ]);
  },

  component: JobsIndexComponent,
});

export function JobsIndexComponent() {
  const navigate = Route.useNavigate();
  const {
    createdAfter,
    createdBefore,
    id,
    limit,
    state,
    kind,
    queue,
    priority,
    sortOrder,
    tags,
  } = Route.useLoaderDeps();
  const refreshSettings = useRefreshSetting();
  const refreshOptions = refreshQueryOptions(refreshSettings.intervalMs);
  const [pauseRefetches, setJobRefetchesPaused] = useState(false);
  const queryClient = useQueryClient();

  const jobsQuery = useQuery(
    jobsQueryOptions(
      {
        createdAfter,
        createdBefore,
        id,
        limit,
        state,
        kind,
        queue,
        priority,
        sortOrder,
        tags,
      },
      {
        pauseRefetches,
        refreshOptions,
      },
    ),
  );
  const statesQuery = useQuery(statesQueryOptions(refreshOptions));

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
          tags?: string[];
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
          tags?: string[];
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
        tags: undefined,
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
          case FilterTypeId.TAGS:
            searchParams.tags = filter.values.length
              ? filter.values
              : undefined;
            break;
        }
      });

      const currentSearchParams = {
        id: id?.map(String),
        kind,
        priority: priority?.map(String),
        queue,
        tags,
      };

      // Avoid no-op navigations that can race with route transitions.
      if (
        areStringArraysEqual(currentSearchParams.id, searchParams.id) &&
        areStringArraysEqual(currentSearchParams.kind, searchParams.kind) &&
        areStringArraysEqual(
          currentSearchParams.priority,
          searchParams.priority,
        ) &&
        areStringArraysEqual(currentSearchParams.queue, searchParams.queue) &&
        areStringArraysEqual(currentSearchParams.tags, searchParams.tags)
      ) {
        return;
      }

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
            tags?: string[];
          },
      });
    },
    [id, kind, navigate, priority, queue, tags],
  );

  // Convert current search params to initial filters
  const initialFilters = useMemo(() => {
    const filters: Filter[] = [];
    if (id !== undefined) {
      filters.push({
        id: "id-filter",
        match: "id:",
        typeId: FilterTypeId.ID,
        values: id.map(String),
      });
    }
    if (kind?.length) {
      filters.push({
        id: "kind-filter",
        match: "kind:",
        typeId: FilterTypeId.KIND,
        values: kind,
      });
    }
    if (priority !== undefined) {
      filters.push({
        id: "priority-filter",
        match: "priority:",
        typeId: FilterTypeId.PRIORITY,
        values: priority.map(String),
      });
    }
    if (queue?.length) {
      filters.push({
        id: "queue-filter",
        match: "queue:",
        typeId: FilterTypeId.QUEUE,
        values: queue,
      });
    }
    if (tags?.length) {
      filters.push({
        id: "tags-filter",
        match: "tags:",
        typeId: FilterTypeId.TAGS,
        values: tags,
      });
    }
    return filters;
  }, [id, kind, priority, queue, tags]);

  const cancelMutation = useMutation({
    mutationFn: async (jobIDs: bigint[], context) =>
      cancelJobs({ ids: jobIDs }, context),
    throwOnError: true,
    onSuccess: () => {
      toastError({
        message: "Jobs cancelled",
        duration: 2000,
      });
      queryClient.invalidateQueries({
        queryKey: listJobsKey({
          createdAfter,
          createdBefore,
          limit,
          state,
          kinds: kind,
          queues: queue,
          priorities: priority,
          ids: id,
          sortOrder,
          tags,
        }),
      });
      queryClient.invalidateQueries({ queryKey: countsByStateKey() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (jobIDs: bigint[], context) =>
      deleteJobs({ ids: jobIDs }, context),
    throwOnError: true,
    onSuccess: async () => {
      toastError({
        message: "Jobs deleted",
        duration: 2000,
      });
      await queryClient.removeQueries({
        queryKey: listJobsKey({
          createdAfter,
          createdBefore,
          limit,
          state,
          kinds: kind,
          queues: queue,
          priorities: priority,
          ids: id,
          sortOrder,
          tags,
        }),
      });
      queryClient.invalidateQueries({ queryKey: countsByStateKey() });
    },
  });

  const retryMutation = useRetryJobs({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listJobsKey({
          createdAfter,
          createdBefore,
          limit,
          state,
          kinds: kind,
          queues: queue,
          priorities: priority,
          ids: id,
          sortOrder,
          tags,
        }),
      });
      queryClient.invalidateQueries({ queryKey: countsByStateKey() });
    },
    successMessage: "Jobs enqueued for retry",
  });

  const handleSortOrderChange = useCallback(
    (newSortOrder: SortOrder | undefined) => {
      navigate({
        replace: true,
        search: (old) =>
          ({ ...old, sortOrder: newSortOrder }) as {
            id?: string[];
            kind?: string[];
            limit: number;
            priority?: string[];
            queue?: string[];
            sortOrder?: SortOrder;
            state: JobState;
            tags?: string[];
          },
      });
    },
    [navigate],
  );

  const handleTimeRangeChange = useCallback(
    (
      newCreatedAfter: string | undefined,
      newCreatedBefore: string | undefined,
    ) => {
      navigate({
        replace: true,
        search: (old) =>
          ({
            ...old,
            createdAfter: newCreatedAfter,
            createdBefore: newCreatedBefore,
          }) as {
            createdAfter?: string;
            createdBefore?: string;
            id?: string[];
            kind?: string[];
            limit: number;
            priority?: string[];
            queue?: string[];
            state: JobState;
            tags?: string[];
          },
      });
    },
    [navigate],
  );

  return (
    <JobList
      cancelJobs={cancelMutation.mutate}
      canShowFewer={canShowFewer}
      canShowMore={canShowMore}
      createdAfter={createdAfter}
      createdBefore={createdBefore}
      deleteJobs={deleteMutation.mutate}
      initialFilters={initialFilters}
      jobs={jobsQuery.data || []}
      loading={jobsQuery.isLoading}
      onFiltersChange={handleFiltersChange}
      onSortOrderChange={handleSortOrderChange}
      onTimeRangeChange={handleTimeRangeChange}
      retryJobs={retryMutation.mutate}
      setJobRefetchesPaused={setJobRefetchesPaused}
      showFewer={showFewer}
      showMore={showMore}
      sortOrder={sortOrder}
      state={state}
      statesAndCounts={statesQuery.data}
    />
  );
}

const jobsQueryOptions = (
  {
    createdAfter,
    createdBefore,
    id,
    limit,
    state,
    kind,
    queue,
    priority,
    sortOrder,
    tags,
  }: {
    createdAfter?: string;
    createdBefore?: string;
    id?: bigint[];
    kind?: string[];
    limit: number;
    priority?: number[];
    queue?: string[];
    sortOrder?: SortOrder;
    state: JobState;
    tags?: string[];
  },
  opts?: { pauseRefetches: boolean; refreshOptions: RefreshQueryOptions },
) => {
  const keepPreviousDataUnlessStateChanged: PlaceholderDataFunction<
    JobMinimal[],
    Error,
    JobMinimal[],
    ListJobsKey
  > = (previousData, previousQuery) => {
    if (!previousQuery) return undefined;
    const [, previousParams] = previousQuery.queryKey;
    if (previousParams.state !== state) return undefined;
    return previousData;
  };
  return queryOptions({
    queryKey: listJobsKey({
      createdAfter,
      createdBefore,
      limit,
      state,
      kinds: kind,
      queues: queue,
      priorities: priority,
      ids: id,
      sortOrder,
      tags,
    }),
    queryFn: listJobs,
    placeholderData: keepPreviousDataUnlessStateChanged,
    ...(opts
      ? opts.pauseRefetches
        ? refreshQueryOptions(0)
        : opts.refreshOptions
      : {}),
  });
};

const statesQueryOptions = (opts?: RefreshQueryOptions) =>
  queryOptions({
    queryKey: countsByStateKey(),
    queryFn: countsByState,
    ...opts,
  });
