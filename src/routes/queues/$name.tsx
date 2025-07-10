import QueueDetail from "@components/QueueDetail";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { listProducers, listProducersKey } from "@services/producers";
import {
  type ConcurrencyConfig,
  getQueue,
  getQueueKey,
  pauseQueue,
  resumeQueue,
  updateQueue,
} from "@services/queues";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, ErrorComponent } from "@tanstack/react-router";
import { NotFoundError } from "@utils/api";

export const Route = createFileRoute("/queues/$name")({
  parseParams: ({ name }) => ({ name }),
  stringifyParams: ({ name }) => ({ name: `${name}` }),

  beforeLoad: ({
    abortController,
    params: { name },
    context: { features },
  }) => {
    return {
      producersQueryOptions: {
        queryKey: listProducersKey(name),
        queryFn: listProducers,
        signal: abortController.signal,
        enabled: features.hasProducerTable && features.producerQueries,
      },
      queueQueryOptions: {
        queryKey: getQueueKey(name),
        queryFn: getQueue,
        signal: abortController.signal,
      },
    };
  },

  loader: async ({
    context: { queryClient, queueQueryOptions, producersQueryOptions },
  }) => {
    await Promise.all([
      queryClient.ensureQueryData(queueQueryOptions),
      // Don't wait for or issue the producers query if it's not enabled:
      ...(producersQueryOptions.enabled
        ? [queryClient.ensureQueryData(producersQueryOptions)]
        : []),
    ]);
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
  const { queueQueryOptions, producersQueryOptions } = Route.useRouteContext();
  const refreshSettings = useRefreshSetting();
  const { features } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const queueQuery = useQuery({
    ...queueQueryOptions,
    refetchInterval: refreshSettings.intervalMs,
  });
  const producersQuery = useQuery({
    ...producersQueryOptions,
    refetchInterval: refreshSettings.intervalMs,
  });

  const loading =
    queueQuery.isLoading ||
    (features.hasProducerTable &&
      features.producerQueries &&
      producersQuery.isLoading);

  const invalidateQueue = () => {
    return queryClient.invalidateQueries({
      queryKey: getQueueKey(name),
    });
  };

  // Mutations for queue actions
  const pauseMutation = useMutation({
    mutationFn: async (queueName: string) => pauseQueue({ name: queueName }),
    throwOnError: true,
    onSuccess: invalidateQueue,
  });

  const resumeMutation = useMutation({
    mutationFn: async (queueName: string) => resumeQueue({ name: queueName }),
    throwOnError: true,
    onSuccess: invalidateQueue,
  });

  const updateQueueMutation = useMutation({
    mutationFn: async ({
      queueName,
      concurrencyConfig,
    }: {
      concurrencyConfig?: ConcurrencyConfig | null;
      queueName: string;
    }) =>
      updateQueue({
        name: queueName,
        concurrency: concurrencyConfig,
      }),
    throwOnError: true,
    onSuccess: invalidateQueue,
  });

  // Wrapper for updateQueueConcurrency to match component prop signature
  const handleUpdateQueueConcurrency = (
    queueName: string,
    concurrency?: ConcurrencyConfig | null,
  ) => {
    updateQueueMutation.mutate({
      queueName,
      concurrencyConfig: concurrency,
    });
  };

  return (
    <QueueDetail
      loading={loading}
      name={name}
      pauseQueue={pauseMutation.mutate}
      producers={producersQuery.data}
      queue={queueQuery.data}
      resumeQueue={resumeMutation.mutate}
      updateQueueConcurrency={handleUpdateQueueConcurrency}
    />
  );
}
