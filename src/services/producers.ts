import type { QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import { ListResponse } from "./listResponse";
import { ConcurrencyConfig } from "./queues";
import { SnakeToCamelCase, StringEndingWithUnderscoreAt } from "./types";

export type Producer = {
  [Key in keyof ProducerFromAPI as SnakeToCamelCase<Key>]: Key extends
    | StringEndingWithUnderscoreAt
    | undefined
    ? Date | undefined
    : ProducerFromAPI[Key];
};

type ProducerFromAPI = {
  client_id: string;
  concurrency: ConcurrencyConfig | null;
  created_at: string;
  id: number;
  max_workers: number;
  paused_at: null | string;
  queue_name: string;
  running: number;
  updated_at: string;
};

export const listProducersKey = (queueName: string) =>
  ["listProducers", queueName] as const;
export type ListProducersKey = ReturnType<typeof listProducersKey>;

const apiProducerToProducer = (producer: ProducerFromAPI): Producer => ({
  clientId: producer.client_id,
  concurrency: producer.concurrency,
  createdAt: new Date(producer.created_at),
  id: producer.id,
  maxWorkers: producer.max_workers,
  pausedAt: producer.paused_at ? new Date(producer.paused_at) : undefined,
  queueName: producer.queue_name,
  running: producer.running,
  updatedAt: new Date(producer.updated_at),
});

export const listProducers: QueryFunction<
  Producer[],
  ListProducersKey
> = async ({ queryKey, signal }) => {
  const [, queueName] = queryKey;
  const query = new URLSearchParams({ queue_name: queueName });

  return API.get<ListResponse<ProducerFromAPI>>(
    { path: "/producers", query },
    { signal },
  ).then((response) => response.data.map(apiProducerToProducer));
};
