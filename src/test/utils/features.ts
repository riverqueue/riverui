import type { Features } from "@services/features";

export const createFeatures = (
  overrides: Partial<Features> = {},
): Features => ({
  durablePeriodicJobs: false,
  featureJobDeletionEnabled: true,
  hasClientTable: false,
  hasProducerTable: false,
  hasSequenceTable: false,
  jobListHideArgsByDefault: false,
  producerQueries: false,
  workflowQueries: false,
  ...overrides,
});
