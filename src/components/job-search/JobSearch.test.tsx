import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobSearch } from "./JobSearch";

// Add type declarations for test functions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
    }
  }
}

// Add type declarations for Jest globals
declare global {
  const describe: (name: string, fn: () => void) => void;
  const it: (name: string, fn: () => void) => void;
  const expect: any;
  const jest: {
    fn: () => any;
  };
}

describe("JobSearch", () => {
  it("renders with initial filters", () => {
    const initialFilters = [
      {
        id: "1",
        typeId: "kind",
        prefix: "kind:",
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);
    expect(screen.getByText("kind:batch")).toBeInTheDocument();
  });

  it("allows adding a new filter", async () => {
    const onFiltersChange = jest.fn();
    render(<JobSearch onFiltersChange={onFiltersChange} />);

    // Click the input to show the filter dropdown
    const input = screen.getByPlaceholderText("Add filter");
    fireEvent.focus(input);

    // Click the "Job Kind" filter type
    const jobKindButton = screen.getByText("Job Kind");
    fireEvent.click(jobKindButton);

    // Verify the filter was added
    expect(screen.getByText("kind:")).toBeInTheDocument();
    expect(onFiltersChange).toHaveBeenCalledWith([
      expect.objectContaining({
        typeId: "kind",
        prefix: "kind:",
        values: [],
      }),
    ]);
  });

  it("allows removing a filter", () => {
    const initialFilters = [
      {
        id: "1",
        typeId: "kind",
        prefix: "kind:",
        values: ["batch"],
      },
    ];
    const onFiltersChange = jest.fn();
    render(
      <JobSearch
        initialFilters={initialFilters}
        onFiltersChange={onFiltersChange}
      />,
    );

    // Click the remove button
    const removeButton = screen.getByRole("button", { name: /remove/i });
    fireEvent.click(removeButton);

    // Verify the filter was removed
    expect(screen.queryByText("kind:batch")).not.toBeInTheDocument();
    expect(onFiltersChange).toHaveBeenCalledWith([]);
  });

  it("shows suggestions when editing a filter", async () => {
    const initialFilters = [
      {
        id: "1",
        typeId: "kind",
        prefix: "kind:",
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const filter = screen.getByText("kind:");
    fireEvent.click(filter);

    // Type to trigger suggestions
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "b");

    // Verify suggestions appear
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });
  });

  it("allows selecting a suggestion with keyboard navigation", async () => {
    const initialFilters = [
      {
        id: "1",
        typeId: "kind",
        prefix: "kind:",
        values: [],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const filter = screen.getByText("kind:");
    fireEvent.click(filter);

    // Type to trigger suggestions
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "b");

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText("batch")).toBeInTheDocument();
    });

    // Press Enter to select the suggestion
    fireEvent.keyDown(input, { key: "Enter" });

    // Verify the suggestion was applied
    expect(screen.getByText("kind:batch")).toBeInTheDocument();
  });

  it("clears all filters when clicking the clear button", () => {
    const initialFilters = [
      {
        id: "1",
        typeId: "kind",
        prefix: "kind:",
        values: ["batch"],
      },
    ];
    const onFiltersChange = jest.fn();
    render(
      <JobSearch
        initialFilters={initialFilters}
        onFiltersChange={onFiltersChange}
      />,
    );

    // Click the clear button
    const clearButton = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearButton);

    // Verify all filters were cleared
    expect(screen.queryByText("kind:batch")).not.toBeInTheDocument();
    expect(onFiltersChange).toHaveBeenCalledWith([]);
  });

  it("handles multiple filter values", async () => {
    const initialFilters = [
      {
        id: "1",
        typeId: "kind",
        prefix: "kind:",
        values: ["batch"],
      },
    ];
    render(<JobSearch initialFilters={initialFilters} />);

    // Click the filter to edit it
    const filter = screen.getByText("kind:batch");
    fireEvent.click(filter);

    // Type a comma to add another value
    const input = screen.getByRole("textbox");
    await userEvent.type(input, ",");

    // Type to trigger suggestions
    await userEvent.type(input, "s");

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText("scheduled")).toBeInTheDocument();
    });

    // Click the suggestion
    fireEvent.click(screen.getByText("scheduled"));

    // Verify both values are present
    expect(screen.getByText("kind:batch,scheduled")).toBeInTheDocument();
  });
});
