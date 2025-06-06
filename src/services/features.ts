import type { QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import { SnakeToCamelCase } from "./types";

export type Features = {
  [Key in keyof FeaturesFromAPI as SnakeToCamelCase<Key>]: FeaturesFromAPI[Key];
};

type FeaturesFromAPI = {
  has_client_table: boolean;
  has_producer_table: boolean;
  has_workflows: boolean;
  job_list_hide_args_by_default: boolean;
};

export const featuresKey = () => ["features"] as const;
export type FeaturesKey = ReturnType<typeof featuresKey>;

export const apiFeaturesToFeatures = (features: FeaturesFromAPI): Features => ({
  hasClientTable: features.has_client_table,
  hasProducerTable: features.has_producer_table,
  hasWorkflows: features.has_workflows,
  jobListHideArgsByDefault: features.job_list_hide_args_by_default,
});

export const getFeatures: QueryFunction<Features, FeaturesKey> = async ({
  signal,
}) => {
  return API.get<FeaturesFromAPI>({ path: "/features" }, { signal }).then(
    apiFeaturesToFeatures,
  );
};
