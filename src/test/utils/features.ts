import type { Features } from "@services/features";

export const createFeatures = (
  overrides: Partial<Features> = {},
): Features => ({
  durablePeriodicJobs: false,
  hasClientTable: false,
  hasProducerTable: false,
  hasSequenceTable: false,
  hasWorkflows: false,
  jobListHideArgsByDefault: false,
  producerQueries: false,
  workflowQueries: false,
  ...overrides,
});
