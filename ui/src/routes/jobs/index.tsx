import { z } from "zod";
import { useQuery } from "@tanstack/react-query";

import { JobState } from "@services/types";
import JobList from "@components/JobList";
import { listJobs, listJobsKey } from "@services/jobs";

import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { createFileRoute } from "@tanstack/react-router";
import { countsByState, countsByStateKey } from "@services/states";

const jobSearchSchema = z.object({
  state: z.nativeEnum(JobState).catch(JobState.Running).optional(),
});

export const Route = createFileRoute("/jobs/")({
  validateSearch: jobSearchSchema,
  beforeLoad: ({ abortController, search }) => {
    return {
      jobsQueryOptions: {
        queryKey: listJobsKey(search),
        queryFn: listJobs,
        refetchInterval: 2000,
        signal: abortController.signal,
      },
      statesQueryOptions: {
        queryKey: countsByStateKey(),
        queryFn: countsByState,
        refetchInterval: 2000,
        signal: abortController.signal,
      },
    };
  },
  loader: async ({
    context: { queryClient, jobsQueryOptions, statesQueryOptions },
  }) => {
    await Promise.all([
      queryClient.ensureQueryData(jobsQueryOptions),
      queryClient.ensureQueryData(statesQueryOptions),
    ]);
  },

  component: JobsIndexComponent,
});

function JobsIndexComponent() {
  const { jobsQueryOptions, statesQueryOptions } = Route.useRouteContext();
  const refreshSettings = useRefreshSetting();
  const refetchInterval = !refreshSettings.disabled
    ? refreshSettings.intervalMs
    : 0;

  const jobsQuery = useQuery(
    Object.assign(jobsQueryOptions, { refetchInterval })
  );
  const statesQuery = useQuery(
    Object.assign(statesQueryOptions, { refetchInterval })
  );

  return (
    <JobList
      loading={jobsQuery.isLoading || !jobsQuery.data}
      jobs={jobsQuery.data || []}
      statesAndCounts={statesQuery.data}
    />
  );
}
