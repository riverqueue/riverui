import { z } from "zod";
import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";

import { JobState } from "@services/types";
import JobList from "@components/JobList";
import { listJobs, listJobsKey } from "@services/jobs";

import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { createFileRoute } from "@tanstack/react-router";
import { countsByState, countsByStateKey } from "@services/states";

const minimumLimit = 20;
const maximumLimit = 200;

const jobSearchSchema = z.object({
  limit: z
    .number()
    .int()
    .min(minimumLimit)
    .max(maximumLimit)
    .default(minimumLimit)
    .catch(minimumLimit)
    .optional(),
  state: z.nativeEnum(JobState).catch(JobState.Running).optional(),
});

export const Route = createFileRoute("/jobs/")({
  validateSearch: jobSearchSchema,
  loaderDeps: ({ search: { limit, state } }) => ({ limit, state }),
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
  const { limit: limitParam } = Route.useSearch();
  const limit = limitParam || minimumLimit;
  const refreshSettings = useRefreshSetting();
  const refetchInterval = !refreshSettings.disabled
    ? refreshSettings.intervalMs
    : 0;

  const jobsQuery = useSuspenseQuery(
    jobsQueryOptions(Route.useLoaderDeps(), { refetchInterval })
  );
  const statesQuery = useQuery(statesQueryOptions({ refetchInterval }));

  const canShowFewer = limit > minimumLimit;
  const canShowMore = limit < maximumLimit;

  const showFewer = () => {
    navigate({
      replace: true,
      search: (old) => ({ ...old, limit: Math.max(limit - 20, minimumLimit) }),
    });
  };
  const showMore = () => {
    navigate({
      replace: true,
      search: (old) => ({ ...old, limit: Math.min(limit + 20, maximumLimit) }),
    });
  };

  return (
    <JobList
      canShowFewer={canShowFewer}
      canShowMore={canShowMore}
      loading={jobsQuery.isLoading}
      jobs={jobsQuery.data || []}
      showFewer={showFewer}
      showMore={showMore}
      statesAndCounts={statesQuery.data}
    />
  );
}

const jobsQueryOptions = (
  {
    limit,
    state,
  }: {
    limit?: number;
    state?: JobState;
  },
  opts?: { refetchInterval: number }
) =>
  queryOptions({
    queryKey: listJobsKey({ limit, state }),
    queryFn: listJobs,
    refetchInterval: opts?.refetchInterval,
  });

const statesQueryOptions = (opts?: { refetchInterval: number }) =>
  queryOptions({
    queryKey: countsByStateKey(),
    queryFn: countsByState,
    refetchInterval: opts?.refetchInterval,
  });
