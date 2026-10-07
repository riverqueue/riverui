import type { QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import { JobState } from "./types";

export type StateCount = {
  accuracy: StateCountAccuracy;
  count: bigint;
  observedAt?: Date;
};

export type StateCountAccuracy =
  "estimated" | "exact_cached" | "exact" | "lower_bound";

export type StatesAndCounts = {
  [Key in JobState]: StateCount;
};

type CountsByStateKey = ["countsByState"];

type StatesAndCountsFromAPI = {
  [Key in JobState]: {
    accuracy: StateCountAccuracy;
    count: number;
    observed_at?: string;
  };
};

const stateCountFromAPI = (
  stateCount: StatesAndCountsFromAPI[JobState],
): StateCount => ({
  accuracy: stateCount.accuracy,
  count: BigInt(stateCount.count),
  observedAt: stateCount.observed_at
    ? new Date(stateCount.observed_at)
    : undefined,
});

export const countsByStateKey = (): CountsByStateKey => {
  return ["countsByState"];
};

export const countsByState: QueryFunction<
  StatesAndCounts,
  CountsByStateKey
> = async ({ signal }) => {
  return API.get<StatesAndCountsFromAPI>({ path: "/states" }, { signal }).then(
    (response) => ({
      available: stateCountFromAPI(response.available),
      cancelled: stateCountFromAPI(response.cancelled),
      completed: stateCountFromAPI(response.completed),
      discarded: stateCountFromAPI(response.discarded),
      pending: stateCountFromAPI(response.pending),
      retryable: stateCountFromAPI(response.retryable),
      running: stateCountFromAPI(response.running),
      scheduled: stateCountFromAPI(response.scheduled),
    }),
  );
};
