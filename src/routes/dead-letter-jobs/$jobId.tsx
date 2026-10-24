import { Button } from "@components/Button";
import DeadLetterJobDetail from "@components/DeadLetterJobDetail";
import NotFoundPage from "@components/NotFoundPage";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { refreshQueryOptions } from "@contexts/RefreshSettings.query";
import {
  getDeadLetterJob,
  getDeadLetterJobKey,
  listDeadLetterJobsKey,
  retryDeadLetterJob,
} from "@services/deadLetterJobs";
import { getJobKey, listJobsKeyPrefix } from "@services/jobs";
import { countsByStateKey } from "@services/states";
import { toastError, toastSuccess } from "@services/toast";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, ErrorComponent } from "@tanstack/react-router";
import { NotFoundError } from "@utils/api";

export const Route = createFileRoute("/dead-letter-jobs/$jobId")({
  parseParams: ({ jobId }) => ({ jobId: BigInt(jobId) }),
  stringifyParams: ({ jobId }) => ({ jobId: jobId.toString() }),
  beforeLoad: ({ params: { jobId } }) => ({
    jobQueryOptions: queryOptions({
      queryFn: getDeadLetterJob,
      queryKey: getDeadLetterJobKey(jobId),
    }),
  }),
  loader: ({ context: { queryClient, jobQueryOptions } }) =>
    queryClient.ensureQueryData(jobQueryOptions),
  errorComponent: ({ error }) =>
    error instanceof NotFoundError ? (
      <NotFoundPage
        action={
          <Button plain to="/dead-letter-jobs">
            Return to dead letters <span aria-hidden="true">&rarr;</span>
          </Button>
        }
        description={error.message}
        heading="Dead letter job not found"
        title="Dead Letter Job"
      />
    ) : (
      <ErrorComponent error={error} />
    ),
  component: DeadLetterJobComponent,
});

export function DeadLetterJobComponent() {
  const { jobId } = Route.useParams();
  const { jobQueryOptions } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { intervalMs } = useRefreshSetting();
  const retry = useMutation({
    mutationFn: retryDeadLetterJob,
    throwOnError: false,
    onMutate: () =>
      queryClient.cancelQueries({ queryKey: getDeadLetterJobKey(jobId) }),
    onError: (error) => {
      toastError({ message: "Job retry failed", subtext: error.message });
    },
    onSuccess: async (job) => {
      queryClient.setQueryData(getJobKey(job.id), job);
      toastSuccess({ message: "Job enqueued for retry", duration: 2000 });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listDeadLetterJobsKey() }),
        queryClient.invalidateQueries({ queryKey: listJobsKeyPrefix }),
        queryClient.invalidateQueries({ queryKey: countsByStateKey() }),
      ]);
      await navigate({ to: "/jobs/$jobId", params: { jobId: job.id } });
      queryClient.removeQueries({ queryKey: getDeadLetterJobKey(jobId) });
    },
  });
  const query = useQuery({
    ...jobQueryOptions,
    ...refreshQueryOptions(intervalMs),
    // Retrying removes this row. Don't poll it while navigating to the new job.
    enabled: !retry.isPending && !retry.isSuccess,
    throwOnError: true,
  });

  if (!query.data) {
    return (
      <p className="p-8 text-sm text-slate-600 dark:text-slate-400">Loading…</p>
    );
  }
  return (
    <DeadLetterJobDetail
      job={query.data}
      retry={() => retry.mutate(jobId)}
      retryPending={retry.isPending || retry.isSuccess}
    />
  );
}
