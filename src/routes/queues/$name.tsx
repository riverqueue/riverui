import QueueDetail from "@components/QueueDetail";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { getQueue, getQueueKey } from "@services/queues";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, ErrorComponent } from "@tanstack/react-router";
// import QueueDetail from "@components/QueueDetail";
import { NotFoundError } from "@utils/api";

export const Route = createFileRoute("/queues/$name")({
  parseParams: ({ name }) => ({ name }),
  stringifyParams: ({ name }) => ({ name: `${name}` }),

  beforeLoad: ({ abortController, params: { name } }) => {
    return {
      queryOptions: {
        queryKey: getQueueKey(name),
        queryFn: getQueue,
        refetchInterval: 2000,
        signal: abortController.signal,
      },
    };
  },

  loader: async ({ context: { queryClient, queryOptions } }) => {
    await queryClient.ensureQueryData(queryOptions);
  },

  errorComponent: ({ error }) => {
    if (error instanceof NotFoundError) {
      return <div>{error.message}</div>;
    }

    return <ErrorComponent error={error} />;
  },

  component: QueueComponent,
});

function QueueComponent() {
  const { name } = Route.useParams();
  const { queryOptions } = Route.useRouteContext();
  const refreshSettings = useRefreshSetting();
  queryOptions.refetchInterval = refreshSettings.intervalMs;

  const queueQuery = useQuery(queryOptions);
  const { data: queue } = queueQuery;

  return (
    <QueueDetail loading={queueQuery.isLoading} name={name} queue={queue} />
  );
}
