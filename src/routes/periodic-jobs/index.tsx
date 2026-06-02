import PeriodicJobList from "@components/PeriodicJobList";
import PeriodicJobListEmptyState from "@components/PeriodicJobListEmptyState";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { refreshQueryOptions } from "@contexts/RefreshSettings.query";
import { listPeriodicJobs, listPeriodicJobsKey } from "@services/periodicJobs";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/periodic-jobs/")({
  beforeLoad: ({ context: { features } }) => {
    return {
      jobsQueryOptions: queryOptions({
        enabled: !!features.durablePeriodicJobs,
        queryFn: listPeriodicJobs,
        queryKey: listPeriodicJobsKey(),
      }),
    };
  },
  loader: async ({ context: { queryClient, jobsQueryOptions } }) => {
    if (!jobsQueryOptions.enabled) return [];
    return await queryClient.ensureQueryData(jobsQueryOptions);
  },
  component: PeriodicJobsIndexComponent,
});

function PeriodicJobsIndexComponent() {
  const { jobsQueryOptions } = Route.useRouteContext();
  const refreshSettings = useRefreshSetting();
  const refreshOptions = refreshQueryOptions(refreshSettings.intervalMs);

  const query = useQuery({ ...jobsQueryOptions, ...refreshOptions });

  if (!jobsQueryOptions.enabled) {
    return <PeriodicJobListEmptyState hasAny={false} />;
  }

  return (
    <>
      {query.isLoading ? (
        <PeriodicJobList jobs={[]} loading />
      ) : (query.data || []).length > 0 ? (
        <PeriodicJobList jobs={query.data || []} loading={false} />
      ) : (
        <PeriodicJobListEmptyState hasAny={true} />
      )}
    </>
  );
}
