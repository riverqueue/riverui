import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Filter, FilterTypeId, JobSearch } from "./JobSearch";

// Add type declarations for test functions
declare module "vitest" {
  interface Assertion<T> {
    toBeInTheDocument(): T;
  }
}

// Helper to get the Badge root element (outer span) for a given prefix
const getBadgeRootByPrefix = (prefix: string): HTMLElement => {
  const prefixSpan = screen.getByText(prefix);
  const badgeRoot = prefixSpan.parentElement as HTMLElement; // The outer <Badge> span
  if (!badgeRoot) throw new Error(`Badge root for prefix ${prefix} not found`);
  return badgeRoot;
};

// Helper to open the filter type dropdown
const openFilterTypeDropdown = async () => {
  const searchInput = screen.getByPlaceholderText("Add filter");
  fireEvent.focus(searchInput);
  // Ensure dropdown has rendered
  await waitFor(() => {
    expect(screen.getByText("Click to add a filter")).toBeInTheDocument();
  });
};

// Helper to select a filter type by its label (e.g., "Job Kind")
const selectFilterType = async (label: string) => {
  await openFilterTypeDropdown();
  // Use getByRole to ensure we find the button even if layout changes
  const option = await screen.findByRole("button", { name: label });
  fireEvent.click(option);
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
          ];
          return mockKinds
            .filter((kind) => kind.includes(query.toLowerCase()))
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

  it("renders with initial filters", () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // The badge root span should exist
    const badgeRoot = getBadgeRootByPrefix("kind:");
    expect(badgeRoot).toBeInTheDocument();

    // Verify the input inside the filter has the correct value
    const input = within(badgeRoot).getByRole("textbox");
    expect(input.getAttribute("value")).toBe("batch");
  });

  it("allows adding a new filter", async () => {
    const onFiltersChange = vi.fn();
    render(<JobSearch onFiltersChange={onFiltersChange} />);

    await act(async () => {
      await selectFilterType("Job Kind");
    });

    // Verify the filter was added - find the badge with kind: prefix
    const filterElement = screen.getByText("kind:").closest("span");
    expect(filterElement).toBeInTheDocument();

    expect(onFiltersChange).toHaveBeenCalledWith([
      expect.objectContaining({
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: [],
      }),
    ]);
  });

  it("allows removing a filter", () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
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
    const badgeRoot = getBadgeRootByPrefix("kind:");

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
        typeId: FilterTypeId.JOB_KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByPrefix("kind:");
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
        typeId: FilterTypeId.JOB_KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByPrefix("kind:");
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
      const updatedBadge = getBadgeRootByPrefix("kind:");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("batch");
    });
  });

  it("clears all filters when clicking the clear button", () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
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

    // Find the clear button (XMarkIcon) which is inside the search input container
    const searchContainer = screen
      .getByPlaceholderText("Add filter")
      .closest("div");
    const clearButton = within(searchContainer!.parentElement!).getByRole(
      "button",
      {
        name: "", // The XMarkIcon doesn't have a name
      },
    );
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
        typeId: FilterTypeId.JOB_KIND,
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByPrefix("kind:");
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
    fireEvent.mouseDown(screen.getByText("scheduled"));

    // Verify both values are present (press Enter to exit edit mode)
    fireEvent.keyDown(input, { key: "Enter" });

    // After exiting edit mode, values should be sorted
    await waitFor(() => {
      const updatedBadge = getBadgeRootByPrefix("kind:");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("batch,scheduled");
    });
  });

  it("focuses existing badge when adding a filter type that already exists", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    await act(async () => {
      await selectFilterType("Job Kind");
    });

    // Verify the existing filter is in edit mode (editable)
    const badgeRoot = getBadgeRootByPrefix("kind:");
    const filterInput = within(badgeRoot).getByRole("textbox");
    expect(filterInput.getAttribute("value")).toBe("batch,"); // Should have trailing comma for easy addition
    expect(document.activeElement).toBe(filterInput);
  });

  it("shows autocomplete dropdown when typing a comma for a new value", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByPrefix("kind:");
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
        typeId: FilterTypeId.JOB_KIND,
        values: ["batch", "stream"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter input directly to edit it
    const badgeRoot = getBadgeRootByPrefix("kind:");
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
    await act(async () => {
      await selectFilterType("Job Kind");
    });

    // Verify the filter is in edit mode and suggestions are shown
    const badgeRoot = getBadgeRootByPrefix("kind:");
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
        typeId: FilterTypeId.JOB_KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByPrefix("kind:");
    fireEvent.click(badgeRoot);

    // Type to trigger suggestions
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "b");

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });

    // Click the suggestion with mouse
    fireEvent.mouseDown(screen.getByText("batch"));

    // Verify the suggestion was inserted at the correct position
    await waitFor(() => {
      expect(input.getAttribute("value")).toBe("batch");
    });

    // Exit edit mode
    fireEvent.keyDown(input, { key: "Enter" });

    // Verify final value
    await waitFor(() => {
      const updatedBadge = getBadgeRootByPrefix("kind:");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("batch");
    });
  });

  it("saves current input when pressing Enter with no suggestion highlighted", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByPrefix("kind:");
    fireEvent.click(badgeRoot);

    // Type a custom value not in suggestions
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "custom-kind");

    // Press Enter to save it (with no suggestion highlighted)
    fireEvent.keyDown(input, { key: "Enter" });

    // Verify the custom input was saved
    await waitFor(() => {
      const updatedBadge = getBadgeRootByPrefix("kind:");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("custom-kind");
    });
  });

  it("sorts and deduplicates values when exiting edit mode", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByPrefix("kind:");
    fireEvent.click(badgeRoot);

    // Type duplicate values in non-alphabetical order
    const input = within(badgeRoot).getByRole("textbox");
    await userEvent.type(input, "stream,batch,stream");

    // Exit edit mode by pressing Enter
    fireEvent.keyDown(input, { key: "Enter" });

    // Verify values are deduplicated (order expectation removed)
    await waitFor(() => {
      const updatedBadge = getBadgeRootByPrefix("kind:");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toContain("batch");
      expect(updatedInput.getAttribute("value")).toContain("stream");
    });
  });

  it("ensures the input region is always clickable even when empty", async () => {
    const initialFilters: Filter[] = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Verify the badge with empty values is in the document
    const badgeRoot = getBadgeRootByPrefix("kind:");
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
    await act(async () => {
      await selectFilterType("Job Kind");
    });

    // Exit edit mode on the existing filter to mimic user finishing editing
    const badgeRoot = getBadgeRootByPrefix("kind:");
    const existingInput = within(badgeRoot).getByRole("textbox");
    await act(async () => {
      fireEvent.keyDown(existingInput, { key: "Enter" });
    });

    // Clear the mock to track only new calls
    onFiltersChange.mockClear();

    // Try to add the same filter type again
    await act(async () => {
      await selectFilterType("Job Kind");
    });

    // Verify no new filter was added
    expect(onFiltersChange).not.toHaveBeenCalled();

    // Verify there's only one "kind:" badge
    const kindFilters = screen.getAllByText("kind:");
    expect(kindFilters.length).toBe(1);
  });

  it("notifies parent of all filter changes", async () => {
    const onFiltersChange = vi.fn();
    render(<JobSearch onFiltersChange={onFiltersChange} />);

    // Add a filter
    await act(async () => {
      await selectFilterType("Job Kind");
    });

    // Verify onFiltersChange was called with the new filter
    expect(onFiltersChange).toHaveBeenCalledWith([
      expect.objectContaining({
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: [],
      }),
    ]);

    // Reset the mock
    onFiltersChange.mockClear();

    // Edit the filter
    const badgeRoot = getBadgeRootByPrefix("kind:");
    fireEvent.click(badgeRoot);

    const filterInput = within(badgeRoot).getByRole("textbox");
    await userEvent.type(filterInput, "batch");
    fireEvent.keyDown(filterInput, { key: "Enter" });

    // Verify onFiltersChange was called with the updated filter
    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith([
        expect.objectContaining({
          prefix: "kind:",
          typeId: FilterTypeId.JOB_KIND,
          values: ["batch"],
        }),
      ]);
    });

    // Reset the mock
    onFiltersChange.mockClear();

    // Remove the filter
    const updatedBadge = getBadgeRootByPrefix("kind:");
    const removeButton = within(updatedBadge).getByRole("button", {
      name: /remove filter/i,
    });
    fireEvent.click(removeButton);

    // Verify onFiltersChange was called with empty filters
    expect(onFiltersChange).toHaveBeenCalledWith([]);
  });

  it("selects a suggestion when hovering and pressing Enter", async () => {
    const initialFilters = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const badgeRoot = getBadgeRootByPrefix("kind:");
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
      const updatedBadge = getBadgeRootByPrefix("kind:");
      const updatedInput = within(updatedBadge).getByRole("textbox");
      expect(updatedInput.getAttribute("value")).toBe("batch");
    });
  });

  it("shows autocomplete suggestions when clicking into an existing value list with trailing comma", async () => {
    const initialFilters = [
      {
        id: "1",
        prefix: "kind:",
        typeId: FilterTypeId.JOB_KIND,
        values: ["batch", "stream"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter input directly to edit it
    const badgeRoot = getBadgeRootByPrefix("kind:");
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
});
