import { describe, expect, it } from "vitest";

import { apiFeaturesToFeatures } from "./features";

describe("apiFeaturesToFeatures", () => {
  it("converts API features to frontend features", () => {
    const apiFeatures = {
      extensions: {
        durable_periodic_jobs: true,
        has_client_table: true,
        has_producer_table: true,
        has_workflows: true,
        producer_queries: true,
        workflow_queries: true,
      },
      job_list_hide_args_by_default: true,
    } as const;

    const expected = {
      durablePeriodicJobs: true,
      hasClientTable: true,
      hasProducerTable: true,
      hasSequenceTable: false,
      hasWorkflows: true,
      jobListHideArgsByDefault: true,
      producerQueries: true,
      workflowQueries: true,
    };

    expect(apiFeaturesToFeatures(apiFeatures)).toEqual(expected);
  });

  it("handles false values", () => {
    const apiFeatures = {
      extensions: {
        durable_periodic_jobs: false,
        has_client_table: false,
        has_producer_table: false,
        has_workflows: false,
        producer_queries: false,
        workflow_queries: false,
      },
      job_list_hide_args_by_default: false,
    } as const;

    const expected = {
      durablePeriodicJobs: false,
      hasClientTable: false,
      hasProducerTable: false,
      hasSequenceTable: false,
      hasWorkflows: false,
      jobListHideArgsByDefault: false,
      producerQueries: false,
      workflowQueries: false,
    };

    expect(apiFeaturesToFeatures(apiFeatures)).toEqual(expected);
  });
});
