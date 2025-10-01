import type { QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import { ListResponse } from "./listResponse";
import { SnakeToCamelCase, StringEndingWithUnderscoreAt } from "./types";

export type PeriodicJob = {
  [Key in keyof PeriodicJobFromAPI as SnakeToCamelCase<Key>]: Key extends
    | StringEndingWithUnderscoreAt
    | undefined
    ? Date
    : PeriodicJobFromAPI[Key];
};

type PeriodicJobFromAPI = {
  created_at: string;
  id: string;
  next_run_at: string;
  updated_at: string;
};

const apiPeriodicJobToPeriodicJob = (job: PeriodicJobFromAPI): PeriodicJob => ({
  createdAt: new Date(job.created_at),
  id: job.id,
  nextRunAt: new Date(job.next_run_at),
  updatedAt: new Date(job.updated_at),
});

type ListPeriodicJobsKey = ["listPeriodicJobs"];

export const listPeriodicJobsKey = (): ListPeriodicJobsKey => {
  return ["listPeriodicJobs"];
};

export const listPeriodicJobs: QueryFunction<
  PeriodicJob[],
  ListPeriodicJobsKey
> = async ({ signal }) => {
  const query = new URLSearchParams({ limit: "100" });
  return API.get<ListResponse<PeriodicJobFromAPI>>(
    { path: "/pro/periodic-jobs", query },
    { signal },
  ).then((response) => response.data.map(apiPeriodicJobToPeriodicJob));
};
