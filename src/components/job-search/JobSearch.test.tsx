import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Filter, FilterTypeId, JobSearch } from "./JobSearch";

// Add type declarations for test functions
declare module "vitest" {
  interface Assertion<T> {
    toBeInTheDocument(): T;
  }
}

// Helper to get the Badge root element (outer span) for a given filter typeId
const getBadgeRootByTypeId = (typeId: string): HTMLElement => {
  const badgeRoot = screen.getByTestId(`filter-badge-${typeId}`);
  if (!badgeRoot) throw new Error(`Badge root for typeId ${typeId} not found`);
  return badgeRoot;
};

// Helper to open the filter type dropdown
const openFilterTypeDropdown = async () => {
  const searchInput = screen.getByPlaceholderText("Add filter");
  fireEvent.focus(searchInput);
  // Wait for any filter type suggestion to appear (e.g., 'kind')
  await waitFor(() => {
    expect(screen.getByTestId("suggestion-kind")).toBeInTheDocument();
  });
};

// Helper to select a filter type by its label (e.g., 'kind', 'id', etc.)
const selectFilterType = async (label: string) => {
  await openFilterTypeDropdown();
  const searchInput = screen.getByTestId("job-search-input");
  fireEvent.focus(searchInput);
  await userEvent.type(searchInput, label);
  // Wait for the specific filter type suggestion to appear
  await waitFor(() => {
    expect(screen.getByTestId(`suggestion-${label}`)).toBeInTheDocument();
  });
  // Click the suggestion using userEvent to better simulate user interaction
  await userEvent.click(screen.getByText(label));
};

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

  it("renders with initial filters", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // The badge root span should exist
    await waitFor(() =>
      expect(screen.getByTestId("filter-badge-kind")).toBeInTheDocument(),
    );
    const badgeRoot = getBadgeRootByTypeId("kind");
    expect(badgeRoot).toBeInTheDocument();

    // Verify the input inside the filter has the correct value
    const input = within(badgeRoot).getByRole("textbox");
    expect(input.getAttribute("value")).toBe("batch");
  });

  it("has password manager prevention attributes on search input", () => {
    render(<JobSearch />);
    const searchInput = screen.getByTestId("job-search-input");
    expect(searchInput).toHaveAttribute("data-1p-ignore");
    expect(searchInput).toHaveAttribute("data-form-type", "other");
    expect(searchInput).toHaveAttribute("autoComplete", "off");
  });

  it("allows adding a new filter", async () => {
    const onFiltersChange = vi.fn();
    render(<JobSearch onFiltersChange={onFiltersChange} />);

    await selectFilterType("kind");

    // Verify the filter was added - find the badge with kind: prefix
    const filterElement = screen.getByText("kind:").closest("span");
    expect(filterElement).toBeInTheDocument();

    expect(onFiltersChange).toHaveBeenCalledWith([
      expect.objectContaining({
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: [],
      }),
    ]);
  });

  it("allows removing a filter", () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch"],
      },
    ];
    const onFiltersChange = vi.fn();
    render(
      <JobSearch
        initialFilters={initialFilters}
        onFiltersChange={onFiltersChange}
      />,
    );

    // Find the kind: badge root
    const badgeRoot = getBadgeRootByTypeId("kind");

    // Click the remove button within the badge
    const removeButton = within(badgeRoot).getByRole("button", {
      name: /remove filter/i,
    });
    fireEvent.click(removeButton);

    // Verify the filter was removed
    expect(screen.queryByText("kind:")).not.toBeInTheDocument();
    expect(onFiltersChange).toHaveBeenCalledWith([]);
  });

  it("shows suggestions when editing a filter", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Get the input element inside the badge
    const input = within(badgeRoot).getByRole("textbox");

    // Type to trigger suggestions
    await userEvent.type(input, "b");

    // Verify suggestions appear
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });
  });

  it("allows selecting a suggestion with keyboard navigation", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Type to trigger suggestions
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "b");

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });

    // Press Down arrow to navigate to the first suggestion
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Press Enter to select the suggestion
    fireEvent.keyDown(input, { key: "Enter" });

    // Verify the suggestion was applied
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("batch");
    });
  });

  it("clears all filters when clicking the clear button", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch"],
      },
    ];
    const onFiltersChange = vi.fn();
    render(
      <JobSearch
        initialFilters={initialFilters}
        onFiltersChange={onFiltersChange}
      />,
    );

    // Find the clear button (XMarkIcon) which might be inside or near the search input container
    const searchContainer = screen
      .getByPlaceholderText("Add filter")
      .closest("div");
    // Look for any button within the search container or its parent that might be the clear button
    const buttons = within(searchContainer!.parentElement!).getAllByRole(
      "button",
    );
    // Assuming the clear button is the last button or has a specific characteristic
    const clearButton = buttons[buttons.length - 1];
    fireEvent.click(clearButton);

    // Verify all filters were cleared
    expect(screen.queryByText("kind:")).not.toBeInTheDocument();
    expect(onFiltersChange).toHaveBeenCalledWith([]);
  });

  it("handles multiple filter values", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Type a comma to add another value
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, ",");

    // Type to trigger suggestions
    await userEvent.type(input, "s");

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText("scheduled")).toBeInTheDocument();
    });

    // Click the suggestion
    await act(async () => {
      fireEvent.mouseDown(screen.getByText("scheduled"));
      // Wait for state updates to complete
      await Promise.resolve();
    });

    // Press Enter to exit edit mode
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      // Wait for state updates to complete
      await Promise.resolve();
    });

    // After exiting edit mode, values should be sorted
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("batch,scheduled");
    });
  });

  it("focuses existing badge when adding a filter type that already exists", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    await selectFilterType("kind");

    // Verify the existing filter is in edit mode (editable)
    const badgeRoot = getBadgeRootByTypeId("kind");
    const filterInput = within(badgeRoot).getByRole("textbox");
    expect(filterInput.getAttribute("value")).toBe("batch,"); // Should have trailing comma for easy addition
    expect(document.activeElement).toBe(filterInput);
  });

  it("shows autocomplete dropdown when typing a comma for a new value", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Type a comma for a new value
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, ",");

    // Verify dropdown shows suggestions for empty input
    await waitFor(
      () => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("appends comma and shows autocomplete suggestions when editing an existing value list", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch", "stream"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter input directly to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    const input = within(badgeRoot).getByRole("textbox");
    await act(async () => {
      fireEvent.click(input);
    });

    // Verify a comma is appended to the input (wait for UI update if needed)
    await waitFor(
      () => {
        expect(input.getAttribute("value")).toBe("batch,stream,");
      },
      { timeout: 3000 },
    );

    // Verify autocomplete suggestions are shown immediately
    await waitFor(
      () => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("shows autocomplete suggestions immediately after adding a new kind filter", async () => {
    render(<JobSearch />);

    // Add a new Job Kind filter
    await selectFilterType("kind");

    // Verify the filter is in edit mode and suggestions are shown
    const badgeRoot = getBadgeRootByTypeId("kind");
    const input = within(badgeRoot).getByRole("textbox");
    expect(document.activeElement).toBe(input);

    // Verify autocomplete suggestions are shown immediately
    await waitFor(
      () => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("selects a suggestion with mouse click at the correct position", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Type to trigger suggestions
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "b");

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });

    // Click the suggestion with mouse
    await act(async () => {
      fireEvent.mouseDown(screen.getByText("batch"));
      // Wait for state updates to complete
      await Promise.resolve();
    });

    // Verify the suggestion was inserted at the correct position
    await waitFor(() => {
      expect(input.getAttribute("value")).toBe("batch");
    });

    // Exit edit mode
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      // Wait for state updates to complete
      await Promise.resolve();
    });

    // Verify final value
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("batch");
    });
  });

  it("saves current input when pressing Enter with no suggestion highlighted", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Type a custom value not in suggestions
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "custom-kind");

    // Press Enter to save it (with no suggestion highlighted)
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      // Wait for state updates to complete
      await Promise.resolve();
    });

    // Verify the custom input was saved
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("custom-kind");
    });
  });

  it("sorts and deduplicates values when exiting edit mode", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Type multiple values with duplicates and out of order
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "stream,batch,stream");

    // Press Enter to save and exit edit mode
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      // Wait for state updates to complete
      await Promise.resolve();
    });

    // Verify values are sorted and deduplicated
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("batch,stream");
    });
  });

  it("ensures the input region is always clickable even when empty", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Verify the badge with empty values is in the document
    const badgeRoot = getBadgeRootByTypeId("kind");
    expect(badgeRoot).toBeInTheDocument();

    // Click input inside badge to enter edit mode
    const input = within(badgeRoot).getByRole("textbox");
    await act(async () => {
      fireEvent.click(input);
    });

    // Verify edit mode was entered
    expect(document.activeElement).toBe(input);
  });

  it("ensures no duplicate filter types can be added", async () => {
    const onFiltersChange = vi.fn();
    render(<JobSearch onFiltersChange={onFiltersChange} />);

    // Add the first filter
    await selectFilterType("kind");

    // Exit edit mode on the existing filter to mimic user finishing editing
    const badgeRoot = getBadgeRootByTypeId("kind");
    const existingInput = within(badgeRoot).getByRole("textbox");
    await act(async () => {
      fireEvent.keyDown(existingInput, { key: "Enter" });
      // Wait for state updates to complete
      await Promise.resolve();
    });

    // Try to add the same filter type again
    await selectFilterType("kind");

    // Verify there's only one "kind:" badge
    const kindFilters = screen.getAllByText("kind:");
    expect(kindFilters.length).toBe(1);

    // Verify the existing filter is in edit mode
    const updatedBadge = getBadgeRootByTypeId("kind");
    const updatedInput = within(updatedBadge).getByRole("textbox");
    expect(document.activeElement).toBe(updatedInput);
  });

  it("notifies parent of all filter changes", async () => {
    const onFiltersChange = vi.fn();
    render(<JobSearch onFiltersChange={onFiltersChange} />);

    // Add a filter
    await selectFilterType("kind");

    // Verify onFiltersChange was called with the new filter
    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith([
        expect.objectContaining({
          prefix: "kind:",
          typeId: FilterTypeId.KIND,
          values: [],
        }),
      ]);
    });

    // Reset the mock
    onFiltersChange.mockClear();

    // Edit the filter
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    const filterInput = within(badgeRoot).getByRole("textbox");
    // Type batch and save
    await userEvent.type(filterInput, "batch");
    await act(async () => {
      fireEvent.keyDown(filterInput, { key: "Enter" });
    });

    // Verify onFiltersChange was called with the updated filter
    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith([
        expect.objectContaining({
          prefix: "kind:",
          typeId: FilterTypeId.KIND,
          values: ["batch"],
        }),
      ]);
    });

    // Reset the mock
    onFiltersChange.mockClear();

    // Remove the filter
    const updatedBadge = getBadgeRootByTypeId("kind");
    const removeButton = within(updatedBadge).getByRole("button", {
      name: /remove filter/i,
    });
    await act(async () => {
      fireEvent.click(removeButton);
    });

    // Verify onFiltersChange was called with empty filters
    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith([]);
    });
  });

  it("selects a suggestion when hovering and pressing Enter", async () => {
    const initialFilters = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Type to trigger suggestions
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "b");

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });

    // Simulate hovering over the first suggestion
    const suggestionButton = screen.getByText("batch");
    fireEvent.mouseEnter(suggestionButton);

    // Press Enter to select the highlighted suggestion
    fireEvent.keyDown(input, { key: "Enter" });

    // Verify the suggestion was applied
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("batch");
    });
  });

  it("shows autocomplete suggestions when clicking into an existing value list with trailing comma", async () => {
    const initialFilters = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch", "stream"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter input directly to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    const input = within(badgeRoot).getByRole("textbox");
    await act(async () => {
      fireEvent.click(input);
    });

    // Verify a comma is appended to the input
    await waitFor(
      () => {
        expect(input.getAttribute("value")).toBe("batch,stream,");
      },
      { timeout: 3000 },
    );

    // Verify autocomplete suggestions are shown for the new empty token
    await waitFor(
      () => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("provides autocomplete suggestions for mid-list edits and correctly replaces the edited value with cursor at updated item end", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch", "stream", "scheduled"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Simulate editing the first value (batch to bat)
    const input = within(badgeRoot).getByRole("textbox");
    await act(async () => {
      fireEvent.change(input, {
        target: {
          selectionEnd: 3,
          selectionStart: 3,
          value: "bat,stream,scheduled",
        },
      });
    });

    // Verify suggestions appear for 'bat', should include 'batch'
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });

    // Select the suggestion 'batch'
    fireEvent.mouseDown(screen.getByText("batch"));

    // Verify the filter list is updated correctly, replacing the first item
    // and cursor is at the end of the updated item 'batch' (position 5)
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole(
        "textbox",
      ) as HTMLInputElement;
      expect(updatedInput.getAttribute("value")).toBe("batch,stream,scheduled");
      expect(updatedInput.selectionStart).toBe(5); // End of 'batch'
      expect(updatedInput.selectionEnd).toBe(5);
    });
  });

  it("hides suggestions dropdown after selecting a suggestion", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Type to trigger suggestions
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "b");

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });

    // Click the suggestion
    fireEvent.mouseDown(screen.getByText("batch"));

    // Verify the dropdown is hidden after selection
    await waitFor(() => {
      expect(
        screen.queryByTestId("suggestions-dropdown"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows autocomplete suggestions after selecting a suggestion and typing a comma", async () => {
    render(<JobSearch />);

    // Add a new filter
    await selectFilterType("kind");

    // Get the filter badge
    const badgeRoot = getBadgeRootByTypeId("kind");
    const input = within(badgeRoot).getByRole("textbox");
    expect(document.activeElement).toBe(input);

    // Verify suggestions are shown
    await waitFor(
      () => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // Type to trigger specific suggestion
    await userEvent.type(input, "b");

    // Wait for 'batch' suggestion
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });

    // Click the suggestion
    fireEvent.mouseDown(screen.getByText("batch"));

    // Wait for suggestion to be applied
    await waitFor(() => {
      expect(input.getAttribute("value")).toBe("batch");
    });

    // Now type a comma to add another value
    await userEvent.type(input, ",");

    // Verify autocomplete suggestions are shown again
    await waitFor(
      () => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("correctly replaces a middle value with suggestion rather than appending it", async () => {
    // Setup initial filter with 3 values
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["AITrainingBatch", "Chaos", "UtilizeNewModel"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Simulate editing the middle value by placing cursor after "Chaos" and removing a character
    const input = within(badgeRoot).getByRole("textbox");
    await act(async () => {
      fireEvent.change(input, {
        target: {
          selectionEnd: 15 + 5, // AITrainingBatch, + cursor after the "s" in Chaos
          selectionStart: 15 + 5,
          value: "AITrainingBatch,Chao,UtilizeNewModel",
        },
      });
    });

    // Verify suggestions appear for 'Chao', should include 'Chaos'
    await waitFor(() => {
      expect(screen.getByText("Chaos")).toBeInTheDocument();
    });

    // Select the suggestion 'Chaos'
    fireEvent.mouseDown(screen.getByText("Chaos"));

    // Verify the filter value is correctly updated with 'Chaos' replacing 'Chao'
    // rather than being appended to the end
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      const value = updatedInput.getAttribute("value");
      expect(value).toBe("AITrainingBatch,Chaos,UtilizeNewModel");
      expect(value).not.toContain("AITrainingBatch,Chao,UtilizeNewModel,Chaos");
    });
  });

  it("shows autocomplete suggestions when creating a gap between values with two commas", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["foo", "bar", "baz"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Get the input and simulate editing
    const input = within(badgeRoot).getByRole("textbox");

    // Add a comma after 'bar' to create a gap
    await act(async () => {
      fireEvent.change(input, {
        target: {
          selectionEnd: 8,
          selectionStart: 8,
          value: "foo,bar,,baz",
        },
      });
    });

    // Verify suggestions dropdown appears for empty value between commas
    await waitFor(() => {
      expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
      const suggestionsList = screen.getByTestId("suggestions-list");
      expect(suggestionsList).toBeInTheDocument();
      // Verify we have suggestions (should show all options since no filter)
      const buttons = within(suggestionsList).getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("removes focus from input when edit mode ends", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    await act(async () => {
      fireEvent.click(badgeRoot);
    });

    // Get the input and verify it's focused
    const input = within(badgeRoot).getByRole("textbox");
    expect(document.activeElement).toBe(input);

    // Press Enter to exit edit mode
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Verify input is no longer focused
    expect(document.activeElement).not.toBe(input);
  });

  it("does not show suggestions dropdown after selecting a suggestion with keyboard", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Type to trigger suggestions
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "b");

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });

    // Navigate to the first suggestion with keyboard
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Select the suggestion with Enter
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      // Wait for state updates to complete
      await Promise.resolve();
    });

    // Verify the suggestion was applied
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("batch");
    });

    // Verify the suggestions dropdown is hidden after selection
    await waitFor(() => {
      expect(
        screen.queryByTestId("suggestions-dropdown"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows autocomplete suggestions for a new entry when editing a filter with a single value", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Get the input and verify cursor position
    const input = within(badgeRoot).getByRole("textbox") as HTMLInputElement;
    await waitFor(() => {
      expect(input.getAttribute("value")).toBe("batch,");
      expect(input.selectionStart).toBe(6); // Should be after the comma
      expect(input.selectionEnd).toBe(6);
    });

    // Verify suggestions are shown for a new entry (not for 'batch')
    await waitFor(() => {
      expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
      const suggestionsList = screen.getByTestId("suggestions-list");
      const buttons = within(suggestionsList).getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
      // Check that suggestions include items other than 'batch'
      const suggestionTexts = buttons.map((btn) => btn.textContent);
      expect(suggestionTexts.some((text) => text !== "batch")).toBe(true);
    });
  });

  it("hides autocomplete suggestions after selecting a replacement value in the middle of a list", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["foo", "bar", "baz"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Simulate editing the middle value by placing cursor after 'bar' and deleting it
    const input = within(badgeRoot).getByRole("textbox");
    await act(async () => {
      fireEvent.change(input, {
        target: {
          selectionEnd: 7, // After 'r' in 'bar'
          selectionStart: 4, // Before 'bar'
          value: "foo,,baz",
        },
      });
    });

    // Verify input value is correct after deletion
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("foo,,baz");
    });

    // Simulate typing 'ba' in the empty spot
    await act(async () => {
      fireEvent.change(input, {
        target: {
          selectionEnd: 5, // After 'a' in 'ba'
          selectionStart: 5,
          value: "foo,ba,baz",
        },
      });
    });

    // Verify input value is correct after typing
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("foo,ba,baz");
    });

    // Verify suggestions appear for 'ba'
    await waitFor(
      () => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByText("batch")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Select the suggestion 'batch'
    await act(async () => {
      fireEvent.mouseDown(screen.getByText("batch"));
      // Wait for state updates to complete
      await Promise.resolve();
    });

    // Verify the filter value is updated correctly
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("foo,batch,baz");
    });

    // Verify the suggestions dropdown is hidden after selection
    await waitFor(() => {
      expect(
        screen.queryByTestId("suggestions-dropdown"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows autocomplete suggestions when backspacing the first value of a newly added filter", async () => {
    render(<JobSearch />);

    // Add a new filter
    await selectFilterType("kind");

    // Get the filter badge
    const badgeRoot = getBadgeRootByTypeId("kind");
    const input = within(badgeRoot).getByRole("textbox");
    expect(document.activeElement).toBe(input);

    // Type to add two values
    await userEvent.type(input, "batch,stream");

    // Move cursor to after 'batch' and backspace
    await act(async () => {
      fireEvent.change(input, {
        target: {
          selectionEnd: 5,
          selectionStart: 5,
          value: "batch,stream",
        },
      });
      // Simulate backspace by setting the value explicitly
      fireEvent.change(input, {
        target: {
          selectionEnd: 4,
          selectionStart: 4,
          value: "batc,stream",
        },
      });
    });

    // Verify input value is correct after backspace
    await waitFor(
      () => {
        expect(input.getAttribute("value")).toBe("batc,stream");
      },
      { timeout: 3000 },
    );

    // Verify suggestions are shown for 'batc'
    await waitFor(
      () => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        const suggestionsList = screen.getByTestId("suggestions-list");
        const suggestionButtons =
          within(suggestionsList).getAllByRole("button");
        expect(suggestionButtons.length).toBeGreaterThan(0);
        const suggestionTexts = suggestionButtons.map((btn) => btn.textContent);
        expect(suggestionTexts).toContain("batch");
      },
      { timeout: 3000 },
    );
  });

  it("emits updated filters during editing for live search refreshing", async () => {
    const onFiltersChange = vi.fn();
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
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

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("kind");
    fireEvent.click(badgeRoot);

    // Type a new value to trigger filter update during editing
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, ",stream");

    // Verify onFiltersChange was called with the updated filter values during editing
    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith([
        expect.objectContaining({
          prefix: "kind:",
          typeId: FilterTypeId.KIND,
          values: ["batch", "stream"],
        }),
      ]);
    });
  });

  it("allows adding a new Job ID filter without autocomplete suggestions", async () => {
    const onFiltersChange = vi.fn();
    render(<JobSearch onFiltersChange={onFiltersChange} />);

    await selectFilterType("id");

    // Verify the filter was added - find the badge with id: prefix
    const filterElement = screen.getByText("id:").closest("span");
    expect(filterElement).toBeInTheDocument();

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByTypeId("id");
    fireEvent.click(badgeRoot);

    // Type a value to ensure no suggestions appear
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "123");

    // Verify no suggestions dropdown appears
    await waitFor(
      () => {
        expect(
          screen.queryByTestId("suggestions-dropdown"),
        ).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // Press Enter to save the value
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      await Promise.resolve();
    });

    // Verify the value was saved
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("id");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("123");
    });

    // Verify onFiltersChange was called with the new filter
    expect(onFiltersChange).toHaveBeenCalledWith([
      expect.objectContaining({
        prefix: "id:",
        typeId: FilterTypeId.ID,
        values: ["123"],
      }),
    ]);
  });

  it("shows filter type suggestions as you type and allows keyboard selection", async () => {
    render(<JobSearch />);
    await waitFor(() => {
      expect(screen.getByTestId("job-search-input")).toBeInTheDocument();
    });
    const input = screen.getByTestId("job-search-input");
    // Focus input and type 'k'
    await act(async () => {
      input.focus();
      await userEvent.type(input, "k");
    });

    // Verify suggestions appear and 'kind' is highlighted
    await waitFor(() => {
      expect(screen.getByText("kind")).toBeInTheDocument();
    });

    // Press Enter to select the highlighted suggestion
    fireEvent.keyDown(input, { code: "Enter", key: "Enter" });

    // Verify the filter is added
    await waitFor(() => {
      expect(screen.getByTestId("filter-badge-kind")).toBeInTheDocument();
    });
  });

  it("filters filter type suggestions as you type", async () => {
    render(<JobSearch />);
    const input = screen.getByTestId("job-search-input");
    await act(async () => {
      input.focus();
      await userEvent.type(input, "pri");
    });

    // Verify only 'priority' is shown, not 'kind'
    await waitFor(() => {
      expect(screen.getByText("priority")).toBeInTheDocument();
      expect(screen.queryByText("kind")).not.toBeInTheDocument();
    });
  });

  it("selects filter type with colon shortcut", async () => {
    render(<JobSearch />);
    const input = screen.getByTestId("job-search-input");
    await act(async () => {
      input.focus();
      await userEvent.type(input, "queue:");
    });

    // Verify the filter is added immediately
    await waitFor(() => {
      expect(screen.getByTestId("filter-badge-queue")).toBeInTheDocument();
    });
  });

  it("closes filter type suggestions and clears input on Escape", async () => {
    render(<JobSearch />);
    const input = screen.getByTestId("job-search-input");
    await act(async () => {
      input.focus();
      await userEvent.type(input, "ki");
    });

    // Verify suggestions appear
    await waitFor(() => {
      expect(screen.getByText("kind")).toBeInTheDocument();
    });

    // Press Escape
    fireEvent.keyDown(input, { code: "Escape", key: "Escape" });

    // Verify suggestions are closed and input is cleared
    await waitFor(() => {
      expect(screen.queryByText("kind")).not.toBeInTheDocument();
      expect(input.getAttribute("value")).toBe("");
    });
  });

  it("highlights first filter type suggestion by default and cycles with arrow keys", async () => {
    render(<JobSearch />);
    const input = screen.getByTestId("job-search-input");
    (input as HTMLInputElement).value = "";
    await act(async () => {
      input.focus();
    });

    // Verify the first suggestion is highlighted
    await waitFor(() => {
      expect(screen.getByText("kind")).toBeInTheDocument();
    });

    // Press ArrowDown to cycle to the next suggestion
    fireEvent.keyDown(input, { code: "ArrowDown", key: "ArrowDown" });

    // Verify the next suggestion is highlighted (assuming 'priority' is next)
    await waitFor(() => {
      expect(screen.getByText("priority")).toBeInTheDocument();
    });
  });

  it("allows arrow key navigation of suggestions immediately after adding a new filter", async () => {
    render(<JobSearch />);

    // Add a new filter
    await selectFilterType("kind");

    // Verify the filter is in edit mode
    const badgeRoot = getBadgeRootByTypeId("kind");
    const input = within(badgeRoot).getByRole("textbox");
    expect(document.activeElement).toBe(input);

    // Verify suggestions are shown
    await waitFor(
      () => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // Press ArrowDown to navigate suggestions without typing anything
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Verify that the first suggestion is highlighted or selected
    await waitFor(() => {
      const suggestionsList = screen.getByTestId("suggestions-list");
      const buttons = within(suggestionsList).getAllByRole("button");
      expect(buttons[0]).toHaveClass("bg-gray-100", "dark:bg-gray-700");
    });
  });

  it("allows arrow key navigation and selection of suggestions immediately after adding a new filter", async () => {
    render(<JobSearch />);

    // Add a new filter
    await selectFilterType("kind");

    // Verify the filter is in edit mode
    const badgeRoot = getBadgeRootByTypeId("kind");
    const input = within(badgeRoot).getByRole("textbox");
    expect(document.activeElement).toBe(input);

    // Verify suggestions are shown
    await waitFor(
      () => {
        expect(screen.getByTestId("suggestions-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // Press ArrowDown to navigate suggestions without typing anything
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Press Enter to select the highlighted suggestion
    fireEvent.keyDown(input, { key: "Enter" });

    // Verify the suggestion was applied
    await waitFor(() => {
      const updatedBadge = getBadgeRootByTypeId("kind");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).not.toBe("");
    });
  });

  it("clears filter type input when leaving field without selecting a suggestion", async () => {
    render(<JobSearch />);
    const input = screen.getByTestId("job-search-input");
    await act(async () => {
      input.focus();
      await userEvent.type(input, "xyz");
    });

    // Verify suggestions appear (or not, since 'xyz' may not match)
    await waitFor(() => {
      expect(input.getAttribute("value")).toBe("xyz");
    });

    // Blur the input (simulate leaving the field)
    await act(async () => {
      fireEvent.blur(input);
    });

    // Verify input is cleared
    await waitFor(() => {
      expect(input.getAttribute("value")).toBe("");
      expect(screen.queryByText("kind")).not.toBeInTheDocument();
      expect(screen.queryByText("priority")).not.toBeInTheDocument();
    });
  });
});
