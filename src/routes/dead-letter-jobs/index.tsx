import DeadLetterJobList from "@components/DeadLetterJobList";
import { Filter } from "@components/job-search/JobSearch";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { refreshQueryOptions } from "@contexts/RefreshSettings.query";
import {
  defaultDeadLetterJobsLimit,
  listDeadLetterJobs,
  listDeadLetterJobsKey,
  maximumDeadLetterJobsLimit,
} from "@services/deadLetterJobs";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import {
  deadLetterJobRouteSearchSchema,
  DeadLetterJobSearch,
  deadLetterJobSearchSchema,
  inputFiltersToSearch,
  searchToDeadLetterFilters,
  searchToInputFilters,
} from "./index.schema";

const jobsQueryOptions = (search: DeadLetterJobSearch) =>
  queryOptions({
    queryFn: listDeadLetterJobs,
    queryKey: listDeadLetterJobsKey(
      search.limit,
      searchToDeadLetterFilters(search),
    ),
  });

export const Route = createFileRoute("/dead-letter-jobs/")({
  validateSearch: deadLetterJobRouteSearchSchema,
  search: {
    middlewares: [stripSearchParams({ limit: defaultDeadLetterJobsLimit })],
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps: search }) =>
    queryClient.ensureQueryData(jobsQueryOptions(search)),
  component: DeadLetterJobsIndexComponent,
});

function DeadLetterJobsIndexComponent() {
  const search = Route.useLoaderDeps();
  const { limit } = search;
  const [filterError, setFilterError] = useState<string>();
  const initialFilters = useMemo(() => searchToInputFilters(search), [search]);
  const navigate = Route.useNavigate();
  const { intervalMs } = useRefreshSetting();
  const query = useQuery({
    ...jobsQueryOptions(search),
    ...refreshQueryOptions(intervalMs),
  });
  const onFiltersChange = useCallback(
    (filters: Filter[]) => {
      const parsed = deadLetterJobSearchSchema.safeParse({
        ...search,
        ...inputFiltersToSearch(filters),
      });
      if (!parsed.success) {
        setFilterError(parsed.error.issues[0]?.message ?? "Invalid filters.");
        return;
      }
      setFilterError(undefined);
      if (JSON.stringify(parsed.data) === JSON.stringify(search)) return;
      void navigate({ replace: true, search: parsed.data });
    },
    [navigate, search],
  );

  return (
    <DeadLetterJobList
      canShowFewer={limit > defaultDeadLetterJobsLimit}
      canShowMore={
        limit < maximumDeadLetterJobsLimit && (query.data?.length ?? 0) >= limit
      }
      filterError={filterError}
      initialFilters={initialFilters}
      jobs={query.data ?? []}
      loadError={
        query.isError
          ? `Couldn't refresh dead letter jobs: ${query.error.message}`
          : undefined
      }
      loading={query.isLoading}
      onFiltersChange={onFiltersChange}
      showFewer={() =>
        navigate({
          replace: true,
          search: (old) => ({
            ...old,
            limit: Math.max(defaultDeadLetterJobsLimit, limit - 20),
          }),
        })
      }
      showMore={() =>
        navigate({
          replace: true,
          search: (old) => ({
            ...old,
            limit: Math.min(maximumDeadLetterJobsLimit, limit + 20),
          }),
        })
      }
    />
  );
}
