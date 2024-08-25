import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import QueueList from "@components/QueueList";
import {
  listQueues,
  listQueuesKey,
  pauseQueue,
  resumeQueue,
} from "@services/queues";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";

export const Route = createFileRoute("/queues/")({
  beforeLoad: ({ abortController }) => {
    return {
      queryOptions: {
        queryKey: listQueuesKey(),
        queryFn: listQueues,
        refetchInterval: 2000,
        signal: abortController.signal,
      },
    };
  },
  loader: async ({ context: { queryClient, queryOptions } }) => {
    await queryClient.ensureQueryData(queryOptions);
  },

  component: QueuesIndexComponent,
});

function QueuesIndexComponent() {
  const { queryOptions } = Route.useRouteContext();
  const refreshSettings = useRefreshSetting();
  queryOptions.refetchInterval = refreshSettings.intervalMs;

  const queryClient = useQueryClient();

  const invalidate = () => {
    return queryClient.invalidateQueries({
      queryKey: queryOptions.queryKey,
    });
  };

  const pauseMutation = useMutation({
    mutationFn: async (name: string) => pauseQueue({ name }),
    throwOnError: true,
    onSuccess: invalidate,
  });
  const resumeMutation = useMutation({
    mutationFn: async (name: string) => resumeQueue({ name }),
    throwOnError: true,
    onSuccess: invalidate,
  });

  const queuesQuery = useQuery(queryOptions);
  const loading = queuesQuery.isLoading || !queuesQuery.data;

  return (
    <QueueList
      loading={loading}
      pauseQueue={pauseMutation.mutate}
      queues={queuesQuery.data || []}
      resumeQueue={resumeMutation.mutate}
    />
  );
}
