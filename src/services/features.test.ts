import { describe, expect, it } from "vitest";

import { apiFeaturesToFeatures } from "./features";

describe("apiFeaturesToFeatures", () => {
  it("converts API features to frontend features", () => {
    const apiFeatures = {
      extensions: {
        producer_queries: true,
        workflow_queries: true,
      },
      has_client_table: true,
      has_producer_table: true,
      has_workflows: true,
      job_list_hide_args_by_default: true,
    };

    const expected = {
      hasClientTable: true,
      hasProducerTable: true,
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
        producer_queries: false,
        workflow_queries: false,
      },
      has_client_table: false,
      has_producer_table: false,
      has_workflows: false,
      job_list_hide_args_by_default: false,
    };

    const expected = {
      hasClientTable: false,
      hasProducerTable: false,
      hasWorkflows: false,
      jobListHideArgsByDefault: false,
      producerQueries: false,
      workflowQueries: false,
    };

    expect(apiFeaturesToFeatures(apiFeatures)).toEqual(expected);
  });
});
