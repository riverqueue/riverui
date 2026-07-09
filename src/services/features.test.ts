import { describe, expect, it } from "vitest";

import { apiFeaturesToFeatures } from "./features";

describe("apiFeaturesToFeatures", () => {
  it("converts API features to frontend features", () => {
    const apiFeatures = {
      extensions: {
        durable_periodic_jobs: true,
        has_producer_table: true,
        producer_queries: true,
        workflow_queries: true,
      },
      job_list_hide_args_by_default: true,
    } as const;

    const expected = {
      durablePeriodicJobs: true,
      hasProducerTable: true,
      hasSequenceTable: false,
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
        has_producer_table: false,
        producer_queries: false,
        workflow_queries: false,
      },
      job_list_hide_args_by_default: false,
    } as const;

    const expected = {
      durablePeriodicJobs: false,
      hasProducerTable: false,
      hasSequenceTable: false,
      jobListHideArgsByDefault: false,
      producerQueries: false,
      workflowQueries: false,
    };

    expect(apiFeaturesToFeatures(apiFeatures)).toEqual(expected);
  });
});
