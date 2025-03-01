import type { QueryFunction } from "@tanstack/react-query";

import type { JobState, SnakeToCamelCase } from "./types";
import { API } from "@utils/api";

export type StatesAndCounts = {
  [Key in JobState as SnakeToCamelCase<Key>]: bigint;
};

type CountsByStateKey = ["countsByState"];

export const countsByStateKey = (): CountsByStateKey => {
  return ["countsByState"];
};

export const countsByState: QueryFunction<
  StatesAndCounts,
  CountsByStateKey
> = async ({ signal }) => {
  return API.get<StatesAndCounts>({ path: "/states" }, { signal }).then(
    (response) => response,
  );
};
