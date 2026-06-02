import QueueList from "@components/QueueList";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { refreshQueryOptions } from "@contexts/RefreshSettings.query";
import {
  listQueues,
  listQueuesKey,
  pauseQueue,
  resumeQueue,
} from "@services/queues";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

export const Route = createFileRoute("/queues/")({
  beforeLoad: ({ abortController }) => {
    return {
      queryOptions: {
        queryKey: listQueuesKey(),
        queryFn: listQueues,
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
  const queryOptionsWithRefresh = useMemo(
    () => ({
      ...queryOptions,
      ...refreshQueryOptions(refreshSettings.intervalMs),
    }),
    [queryOptions, refreshSettings.intervalMs],
  );

  const queryClient = useQueryClient();

  const invalidate = () => {
    return queryClient.invalidateQueries({
      queryKey: queryOptionsWithRefresh.queryKey,
    });
  };

  const pauseMutation = useMutation({
    mutationFn: async (name: string, context) => pauseQueue({ name }, context),
    throwOnError: true,
    onSuccess: invalidate,
  });
  const resumeMutation = useMutation({
    mutationFn: async (name: string, context) => resumeQueue({ name }, context),
    throwOnError: true,
    onSuccess: invalidate,
  });

  const queuesQuery = useQuery(queryOptionsWithRefresh);
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
