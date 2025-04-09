import type { MutationFunction, QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import type { SnakeToCamelCase, StringEndingWithUnderscoreAt } from "./types";

import { ListResponse } from "./listResponse";

export interface ConcurrencyConfig {
  global_limit: number;
  local_limit: number;
  partition: PartitionConfig;
}

export interface PartitionConfig {
  by_args: null | string[];
  by_kind: null | string[];
}

export type Queue = {
  [Key in keyof QueueFromAPI as SnakeToCamelCase<Key>]: Key extends
    | StringEndingWithUnderscoreAt
    | undefined
    ? Date
    : QueueFromAPI[Key];
};

// Represents a Queue as received from the API. This just like Queue, except with
// string dates instead of Date objects and keys as snake_case instead of
// camelCase.
export type QueueFromAPI = {
  concurrency: ConcurrencyConfig | null;
  count_available: number;
  count_running: number;
  created_at: string;
  name: string;
  paused_at?: string;
  updated_at: string;
};

export const apiQueueToQueue = (queue: QueueFromAPI): Queue => ({
  concurrency: queue.concurrency,
  countAvailable: queue.count_available,
  countRunning: queue.count_running,
  createdAt: new Date(queue.created_at),
  name: queue.name,
  pausedAt: queue.paused_at ? new Date(queue.paused_at) : undefined,
  updatedAt: new Date(queue.updated_at),
});

type GetQueueKey = ["getQueue", string];

export const getQueueKey = (name: string): GetQueueKey => {
  return ["getQueue", name.toString()];
};

export const getQueue: QueryFunction<Queue, GetQueueKey> = async ({
  queryKey,
  signal,
}) => {
  const [, name] = queryKey;
  return (
    API.get<QueueFromAPI>({ path: `/queues/${name}` }, { signal })
      // Map from QueueFromAPI to Queue:
      .then(apiQueueToQueue)
  );
};

type ListQueuesKey = ["listQueues"];

export const listQueuesKey = (): ListQueuesKey => {
  return ["listQueues"];
};

export const listQueues: QueryFunction<Queue[], ListQueuesKey> = async ({
  signal,
}) => {
  const query = new URLSearchParams({ limit: "100" });
  return API.get<ListResponse<QueueFromAPI>>(
    { path: "/queues", query },
    { signal },
  ).then(
    // Map from QueueFromAPI to Queue:
    (response) => response.data.map(apiQueueToQueue),
  );
};

type QueueNamePayload = {
  name: string;
};

export const pauseQueue: MutationFunction<void, QueueNamePayload> = async ({
  name,
}) => {
  return API.put(`/queues/${name}/pause`);
};

export const resumeQueue: MutationFunction<void, QueueNamePayload> = async ({
  name,
}) => {
  return API.put(`/queues/${name}/resume`);
};

type UpdateQueuePayload = {
  concurrency?: ConcurrencyConfig | null;
  name: string;
};

export const updateQueue: MutationFunction<void, UpdateQueuePayload> = async ({
  concurrency,
  name,
}) => {
  return API.patch(`/queues/${name}`, JSON.stringify({ concurrency }), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
