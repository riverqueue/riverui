import { describe, expect, it } from "vitest";

import {
  analyzeAutocompleteContext,
  applySuggestion,
  consolidateFiltersText,
  parseFiltersFromText,
  serializeFiltersToText,
} from "./parser";
import { JobFilterTypeID } from "./types";

describe("parser", () => {
  describe("parseFiltersFromText", () => {
    it("parses simple filters", () => {
      const result = parseFiltersFromText("kind:batch queue:priority");
      expect(result).toHaveLength(2);
      expect(result[0].match).toBe("kind:");
      expect(result[0].values).toEqual(["batch"]);
      expect(result[1].match).toBe("queue:");
      expect(result[1].values).toEqual(["priority"]);
    });

    it("parses comma-separated values", () => {
      const result = parseFiltersFromText("kind:batch,stream");
      expect(result).toHaveLength(1);
      expect(result[0].values).toEqual(["batch", "stream"]);
    });

    it("consolidates duplicate filter types", () => {
      const result = parseFiltersFromText("kind:batch kind:stream");
      expect(result).toHaveLength(1);
      expect(result[0].values).toEqual(["batch", "stream"]);
    });

    it("sorts values within each filter", () => {
      const result = parseFiltersFromText("kind:zebra,alpha,batch");
      expect(result).toHaveLength(1);
      expect(result[0].values).toEqual(["alpha", "batch", "zebra"]);
    });

    it("handles empty input", () => {
      const result = parseFiltersFromText("");
      expect(result).toHaveLength(0);
    });

    it("ignores invalid expressions", () => {
      const result = parseFiltersFromText("invalid kind:batch");
      expect(result).toHaveLength(1);
      expect(result[0].match).toBe("kind:");
    });
  });

  describe("serializeFiltersToText", () => {
    it("serializes filters to text", () => {
      const filters = [
        {
          id: "1",
          match: "kind:",
          typeId: JobFilterTypeID.KIND,
          values: ["batch", "stream"],
        },
        {
          id: "2",
          match: "queue:",
          typeId: JobFilterTypeID.QUEUE,
          values: ["priority"],
        },
      ];
      const result = serializeFiltersToText(filters);
      expect(result).toBe("kind:batch,stream queue:priority");
    });

    it("skips filters with no values", () => {
      const filters = [
        {
          id: "1",
          match: "kind:",
          typeId: JobFilterTypeID.KIND,
          values: [],
        },
        {
          id: "2",
          match: "queue:",
          typeId: JobFilterTypeID.QUEUE,
          values: ["priority"],
        },
      ];
      const result = serializeFiltersToText(filters);
      expect(result).toBe("queue:priority");
    });
  });

  describe("consolidateFiltersText", () => {
    it("consolidates duplicate filter types", () => {
      const input =
        "kind:AITrainingBatch,AnalyzeTextCorpus kind:Chaos priority:2";
      const result = consolidateFiltersText(input);
      expect(result).toBe(
        "kind:AITrainingBatch,AnalyzeTextCorpus,Chaos priority:2",
      );
    });

    it("sorts values within consolidated filters", () => {
      const input = "kind:zebra kind:alpha kind:batch";
      const result = consolidateFiltersText(input);
      expect(result).toBe("kind:alpha,batch,zebra");
    });

    it("handles multiple filter types with duplicates", () => {
      const input = "kind:batch queue:high kind:stream queue:low priority:1";
      const result = consolidateFiltersText(input);
      expect(result).toBe("kind:batch,stream queue:high,low priority:1");
    });

    it("preserves order of first appearance of filter types", () => {
      const input = "queue:high kind:batch queue:low";
      const result = consolidateFiltersText(input);
      expect(result).toBe("queue:high,low kind:batch");
    });

    it("removes duplicate values within the same filter type", () => {
      const input = "kind:batch,stream kind:batch";
      const result = consolidateFiltersText(input);
      expect(result).toBe("kind:batch,stream");
    });

    it("handles empty input", () => {
      const result = consolidateFiltersText("");
      expect(result).toBe("");
    });

    it("handles input with no consolidation needed", () => {
      const input = "kind:batch queue:priority";
      const result = consolidateFiltersText(input);
      expect(result).toBe("kind:batch queue:priority");
    });
  });

  describe("analyzeAutocompleteContext", () => {
    it("detects filter type context", () => {
      const result = analyzeAutocompleteContext("ki", 2);
      expect(result.type).toBe("filter-type");
      expect(result.currentToken).toBe("ki");
    });

    it("detects filter value context", () => {
      const result = analyzeAutocompleteContext("kind:bat", 8);
      expect(result.type).toBe("filter-value");
      expect(result.currentToken).toBe("bat");
      expect(result.filterTypeId).toBe("kind");
    });

    it("respects suppression flag", () => {
      const result = analyzeAutocompleteContext("ki", 2, true);
      expect(result.type).toBe("none");
    });
  });

  describe("applySuggestion", () => {
    it("applies filter type suggestion", () => {
      const result = applySuggestion("ki", 2, "kind", "filter-type");
      expect(result.newText).toBe("kind:");
      expect(result.newCursorPos).toBe(5);
    });

    it("applies filter value suggestion", () => {
      const result = applySuggestion("kind:bat", 8, "batch", "filter-value");
      expect(result.newText).toBe("kind:batch");
      expect(result.newCursorPos).toBe(10);
    });

    it("applies filter value suggestion in comma-separated list", () => {
      const result = applySuggestion(
        "kind:batch,st",
        13,
        "stream",
        "filter-value",
      );
      expect(result.newText).toBe("kind:batch,stream");
      expect(result.newCursorPos).toBe(17);
    });
  });
});
