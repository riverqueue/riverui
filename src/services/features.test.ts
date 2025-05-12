import { describe, expect, it } from "vitest";

import { apiFeaturesToFeatures } from "./features";

describe("apiFeaturesToFeatures", () => {
  it("converts API features to frontend features", () => {
    const apiFeatures = {
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
    };

    expect(apiFeaturesToFeatures(apiFeatures)).toEqual(expected);
  });

  it("handles false values", () => {
    const apiFeatures = {
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
    };

    expect(apiFeaturesToFeatures(apiFeatures)).toEqual(expected);
  });
});
