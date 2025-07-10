import type { QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import { SnakeToCamelCase } from "./types";

export type Features = {
  [Key in keyof Omit<
    FeaturesFromAPI,
    "extensions"
  > as SnakeToCamelCase<Key>]: FeaturesFromAPI[Key];
} & KnownExtensions;

type FeaturesFromAPI = {
  extensions: Record<string, boolean>;
  has_client_table: boolean;
  has_producer_table: boolean;
  has_workflows: boolean;
  job_list_hide_args_by_default: boolean;
};

const KNOWN_EXTENSIONS = ["producer_queries", "workflow_queries"] as const;
type KnownExtensionKey = (typeof KNOWN_EXTENSIONS)[number];

type KnownExtensions = {
  [Key in keyof KnownExtensionsFromAPI as SnakeToCamelCase<Key>]: KnownExtensionsFromAPI[Key];
};

// Generate types from the single source of truth
type KnownExtensionsFromAPI = Record<KnownExtensionKey, boolean>;

export const featuresKey = () => ["features"] as const;
export type FeaturesKey = ReturnType<typeof featuresKey>;

// Helper function to convert known extension keys to properly typed camelCase
const toKnownExtensionKey = (
  snakeKey: KnownExtensionKey,
): keyof KnownExtensions => {
  return snakeKey.replace(/_([a-z])/g, (_, letter) =>
    letter.toUpperCase(),
  ) as keyof KnownExtensions;
};

export const apiFeaturesToFeatures = (features: FeaturesFromAPI): Features => {
  const { extensions } = features;

  // Extract known extensions dynamically
  const knownExtensions: Partial<KnownExtensions> = {};

  for (const [key, value] of Object.entries(extensions)) {
    if (KNOWN_EXTENSIONS.includes(key as KnownExtensionKey)) {
      // Convert snake_case to camelCase for known extensions
      const camelKey = toKnownExtensionKey(key as KnownExtensionKey);
      knownExtensions[camelKey] = value;
    }
  }

  // Ensure all known extensions have default values by iterating over KNOWN_EXTENSIONS
  const completeKnownExtensions: KnownExtensions = {} as KnownExtensions;
  for (const snakeKey of KNOWN_EXTENSIONS) {
    const camelKey = toKnownExtensionKey(snakeKey);
    completeKnownExtensions[camelKey] = knownExtensions[camelKey] ?? false;
  }

  return {
    hasClientTable: features.has_client_table,
    hasProducerTable: features.has_producer_table,
    hasWorkflows: features.has_workflows,
    jobListHideArgsByDefault: features.job_list_hide_args_by_default,
    ...completeKnownExtensions,
  };
};

export const getFeatures: QueryFunction<Features, FeaturesKey> = async ({
  signal,
}) => {
  return API.get<FeaturesFromAPI>({ path: "/features" }, { signal }).then(
    apiFeaturesToFeatures,
  );
};
