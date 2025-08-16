import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { userEvent } from "storybook/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Filter, FilterTypeId, JobSearch } from "./JobSearch";

// Add type declarations for test functions
declare module "vitest" {
  interface Assertion<T> {
    toBeInTheDocument(): T;
  }
}

describe("JobSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mock("./api", () => ({
      fetchSuggestions: async (
        filterTypeId: string,
        query: string,
        selectedValues: string[],
      ) => {
        if (filterTypeId === "kind") {
          const mockKinds = [
            "batch",
            "stream",
            "scheduled",
            "one-time",
            "recurring",
            "Chaos",
            "AITrainingBatch",
            "UtilizeNewModel",
          ];
          return mockKinds
            .filter((kind) => kind.toLowerCase().includes(query.toLowerCase()))
            .filter((kind) => !selectedValues.includes(kind));
        } else if (filterTypeId === "queue") {
          const mockQueues = [
            "default",
            "high-priority",
            "low-priority",
            "batch",
            "realtime",
          ];
          return mockQueues
            .filter((queue) => queue.includes(query.toLowerCase()))
            .filter((queue) => !selectedValues.includes(queue));
        } else if (filterTypeId === "priority") {
          const priorities = ["1", "2", "3", "4"];
          return priorities
            .filter((priority) => priority.includes(query))
            .filter((priority) => !selectedValues.includes(priority));
        }
        return [];
      },
    }));
  });

  describe("Basic Rendering & Props", () => {
    it("renders with initial filters", async () => {
      const initialFilters: Filter[] = [
        {
          id: "1",
          match: "kind:",
          typeId: FilterTypeId.KIND,
          values: ["batch"],
        },
      ];
      render(<JobSearch initialFilters={initialFilters} />);

      const searchInput = screen.getByTestId("job-search-input");
      expect(searchInput.getAttribute("value")).toBe("kind:batch");
    });

    it("has password manager prevention attributes on search input", () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");
      expect(searchInput).toHaveAttribute("data-1p-ignore");
      expect(searchInput).toHaveAttribute("data-form-type", "other");
      expect(searchInput).toHaveAttribute("autoComplete", "off");
    });

    it("notifies parent of filter changes", async () => {
      const onFiltersChange = vi.fn();
      render(<JobSearch onFiltersChange={onFiltersChange} />);

      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:batch");
      });

      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledWith([
          expect.objectContaining({
            match: "kind:",
            typeId: FilterTypeId.KIND,
            values: ["batch"],
          }),
        ]);
      });
    });

    it("debounces filter changes", async () => {
      const onFiltersChange = vi.fn();
      render(<JobSearch onFiltersChange={onFiltersChange} />);

      const searchInput = screen.getByTestId("job-search-input");

      // Type quickly
      await act(async () => {
        await userEvent.type(searchInput, "kind:batch");
      });

      // Should not have called onFiltersChange immediately
      expect(onFiltersChange).not.toHaveBeenCalled();

      // Wait for debounce
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 350));
      });

      // Should have called onFiltersChange after debounce
      expect(onFiltersChange).toHaveBeenCalledWith([
        expect.objectContaining({
          match: "kind:",
          typeId: FilterTypeId.KIND,
          values: ["batch"],
        }),
      ]);
    });
  });

  describe("Suggestion System", () => {
    it("shows filter type suggestions when typing", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "k");
      });

      await waitFor(() => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("suggestion-kind")).toBeInTheDocument();
      });
    });

    it("filters suggestions based on current input", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "pri");
      });

      await waitFor(() => {
        expect(screen.getByTestId("suggestion-priority")).toBeInTheDocument();
        expect(screen.queryByTestId("suggestion-kind")).not.toBeInTheDocument();
      });
    });

    it("shows value suggestions after selecting a filter type", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:");
      });

      await waitFor(() => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("suggestion-batch")).toBeInTheDocument();
      });
    });

    it("shows value suggestions that filter based on existing values", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:batch,");
      });

      await waitFor(() => {
        const suggestionsList = screen.getByTestId("suggestions-list");
        const buttons = suggestionsList.querySelectorAll("button");
        const suggestionTexts = Array.from(buttons).map(
          (btn) => btn.textContent,
        );

        // Should show suggestions but not include "batch" since it's already selected
        expect(suggestionTexts).toContain("stream");
        expect(suggestionTexts).not.toContain("batch");
      });
    });

    it("shows suggestions immediately after applying filter type", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind");
      });

      await waitFor(() => {
        expect(screen.getByTestId("suggestion-kind")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.mouseDown(screen.getByText("kind"));
      });

      // Wait for both the suggestion application and the subsequent suggestion loading
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should immediately show value suggestions
      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("kind:");
        expect(screen.getByTestId("suggestion-batch")).toBeInTheDocument();
      });
    });

    it("supports ID filter without suggestions", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "id:12345");
      });

      // Should not show suggestions for ID values
      await waitFor(() => {
        expect(
          screen.queryByTestId("suggestions-dropdown"),
        ).not.toBeInTheDocument();
      });

      expect(searchInput.getAttribute("value")).toBe("id:12345");
    });
  });

  describe("User Interactions", () => {
    it("allows selecting a filter type suggestion", async () => {
      const onFiltersChange = vi.fn();
      render(<JobSearch onFiltersChange={onFiltersChange} />);

      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind");
      });

      await waitFor(() => {
        expect(screen.getByTestId("suggestion-kind")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.mouseDown(screen.getByText("kind"));
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("kind:");
      });

      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledWith([
          expect.objectContaining({
            match: "kind:",
            typeId: FilterTypeId.KIND,
            values: [],
          }),
        ]);
      });
    });

    it("allows selecting value suggestions", async () => {
      const onFiltersChange = vi.fn();
      render(<JobSearch onFiltersChange={onFiltersChange} />);

      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:");
      });

      await waitFor(() => {
        expect(screen.getByTestId("suggestion-batch")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.mouseDown(screen.getByText("batch"));
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("kind:batch");
      });

      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledWith([
          expect.objectContaining({
            match: "kind:",
            typeId: FilterTypeId.KIND,
            values: ["batch"],
          }),
        ]);
      });
    });

    it("handles colon shortcut for filter types", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      // Type "queue:" directly
      await act(async () => {
        await userEvent.type(searchInput, "queue:");
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("queue:");
        // Should show value suggestions for queue
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
      });
    });

    it("clears all filters when clicking the clear button", async () => {
      const onFiltersChange = vi.fn();
      const initialFilters: Filter[] = [
        {
          id: "1",
          match: "kind:",
          typeId: FilterTypeId.KIND,
          values: ["batch"],
        },
      ];
      render(
        <JobSearch
          initialFilters={initialFilters}
          onFiltersChange={onFiltersChange}
        />,
      );

      const searchInput = screen.getByTestId("job-search-input");
      expect(searchInput.getAttribute("value")).toBe("kind:batch");

      // Find and click the clear button (X icon)
      const clearButton = screen.getByRole("button");
      await act(async () => {
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("");
      });

      // Wait for the debounced onFiltersChange callback
      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledWith([]);
      });
    });

    it("applies suggestion and moves cursor correctly", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:bat");
      });

      await waitFor(() => {
        expect(screen.getByTestId("suggestion-batch")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.mouseDown(screen.getByText("batch"));
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("kind:batch");
        // Cursor should be at the end of "batch"
        expect((searchInput as HTMLInputElement).selectionStart).toBe(10);
      });
    });

    it("handles cursor position correctly for autocomplete", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:batch que");
      });

      // Place cursor after "que" to trigger filter type suggestions
      await act(async () => {
        fireEvent.click(searchInput);
        (searchInput as HTMLInputElement).setSelectionRange(14, 14); // End of "que"
        fireEvent.select(searchInput);
      });

      await waitFor(() => {
        // Should show filter type suggestions for "que"
        expect(screen.getByTestId("suggestion-queue")).toBeInTheDocument();
      });
    });
  });

  describe("Keyboard Navigation", () => {
    it("allows keyboard navigation of suggestions", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "k");
      });

      await waitFor(() => {
        expect(screen.getByTestId("suggestion-kind")).toBeInTheDocument();
      });

      // Press down arrow to highlight first suggestion
      await act(async () => {
        fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      });

      // Press enter to select highlighted suggestion
      await act(async () => {
        fireEvent.keyDown(searchInput, { key: "Enter" });
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("kind:");
      });
    });

    it("escapes to clear suggestions and input", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind");
      });

      await waitFor(() => {
        expect(screen.getByTestId("suggestion-kind")).toBeInTheDocument();
      });

      // First escape closes suggestions
      await act(async () => {
        fireEvent.keyDown(searchInput, { key: "Escape" });
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId("suggestions-dropdown"),
        ).not.toBeInTheDocument();
      });

      // Second escape clears input
      await act(async () => {
        fireEvent.keyDown(searchInput, { key: "Escape" });
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("");
      });
    });
  });

  describe("Filter Management", () => {
    it("allows adding multiple values to a filter", async () => {
      const onFiltersChange = vi.fn();
      render(<JobSearch onFiltersChange={onFiltersChange} />);

      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:batch,stream");
      });

      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledWith([
          expect.objectContaining({
            match: "kind:",
            typeId: FilterTypeId.KIND,
            values: ["batch", "stream"],
          }),
        ]);
      });
    });

    it("allows adding multiple different filter types", async () => {
      const onFiltersChange = vi.fn();
      render(<JobSearch onFiltersChange={onFiltersChange} />);

      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:batch queue:priority");
      });

      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledWith([
          expect.objectContaining({
            match: "kind:",
            typeId: FilterTypeId.KIND,
            values: ["batch"],
          }),
          expect.objectContaining({
            match: "queue:",
            typeId: FilterTypeId.QUEUE,
            values: ["priority"],
          }),
        ]);
      });
    });

    it("handles spaces around filter expressions", async () => {
      const onFiltersChange = vi.fn();
      render(<JobSearch onFiltersChange={onFiltersChange} />);

      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "  kind:batch   queue:priority  ");
      });

      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledWith([
          expect.objectContaining({
            match: "kind:",
            typeId: FilterTypeId.KIND,
            values: ["batch"],
          }),
          expect.objectContaining({
            match: "queue:",
            typeId: FilterTypeId.QUEUE,
            values: ["priority"],
          }),
        ]);
      });
    });
  });

  describe("Filter Consolidation", () => {
    it("consolidates duplicate filter types on blur", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(
          searchInput,
          "kind:AITrainingBatch,AnalyzeTextCorpus kind:Chaos priority:2",
        );
      });

      await act(async () => {
        fireEvent.blur(searchInput);
      });

      // Wait for the setTimeout in onBlur to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe(
          "kind:AITrainingBatch,AnalyzeTextCorpus,Chaos priority:2",
        );
      });
    });

    it("sorts values within consolidated filters", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:zebra kind:alpha kind:batch");
      });

      await act(async () => {
        fireEvent.blur(searchInput);
      });

      // Wait for the setTimeout in onBlur to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe(
          "kind:alpha,batch,zebra",
        );
      });
    });

    it("preserves order of first appearance of filter types during consolidation", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(
          searchInput,
          "queue:high kind:batch queue:low priority:1",
        );
      });

      await act(async () => {
        fireEvent.blur(searchInput);
      });

      // Wait for the setTimeout in onBlur to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe(
          "queue:high,low kind:batch priority:1",
        );
      });
    });

    it("removes duplicate values within the same filter type during consolidation", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:batch,stream kind:batch");
      });

      await act(async () => {
        fireEvent.blur(searchInput);
      });

      // Wait for the setTimeout in onBlur to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("kind:batch,stream");
      });
    });

    it("does not consolidate when input has no duplicate filter types", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");
      const originalValue = "kind:batch queue:priority";

      await act(async () => {
        await userEvent.type(searchInput, originalValue);
      });

      await act(async () => {
        fireEvent.blur(searchInput);
      });

      // Wait for the setTimeout in onBlur to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe(originalValue);
      });
    });

    it("preserves trailing whitespace on blur", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "kind:batch "); // note trailing space
      });

      await act(async () => {
        fireEvent.blur(searchInput);
      });

      // Wait for consolidation logic to finish
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("kind:batch ");
      });
    });
  });

  describe("Input Validation", () => {
    it("clears invalid filter type text on blur", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(searchInput, "invalidfilter");
      });

      await act(async () => {
        fireEvent.blur(searchInput);
      });

      // Wait for the setTimeout in onBlur to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe("");
      });
    });

    it("handles mixed valid and invalid input", async () => {
      render(<JobSearch />);
      const searchInput = screen.getByTestId("job-search-input");

      await act(async () => {
        await userEvent.type(
          searchInput,
          "kind:batch invalidtext queue:priority",
        );
      });

      await act(async () => {
        fireEvent.blur(searchInput);
      });

      // Wait for the setTimeout in onBlur to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should keep valid filters and remove invalid text
      await waitFor(() => {
        expect(searchInput.getAttribute("value")).toBe(
          "kind:batch queue:priority",
        );
      });
    });
  });
});
