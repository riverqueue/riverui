import type { Meta, StoryObj } from "@storybook/react-vite";

import { useCallback, useRef, useState } from "react";

import { Filter, FilterTypeId, JobSearch } from "./JobSearch";

// Mock fetchSuggestions function for stories
const mockFetchSuggestions = async (
  filterTypeId: FilterTypeId,
  query: string,
  selectedValues: string[],
): Promise<string[]> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Return different suggestions based on filter type
  let suggestions: string[] = [];
  switch (filterTypeId) {
    case FilterTypeId.KIND:
      suggestions = ["email", "sms", "push", "webhook"];
      break;
    case FilterTypeId.PRIORITY:
      suggestions = ["high", "medium", "low"];
      break;
    case FilterTypeId.QUEUE:
      suggestions = ["default", "high-priority", "low-priority"];
      break;
  }

  // Filter by query and exclude already selected values
  return suggestions
    .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
    .filter((s) => !selectedValues.includes(s));
};

const meta: Meta<typeof JobSearch> = {
  component: JobSearch,
  parameters: {
    layout: "fullscreen",
  },
  title: "Components/JobSearch",
};

export default meta;
type Story = StoryObj<typeof JobSearch>;

export const Default: Story = {
  render: () => (
    <div className="w-full p-4">
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Default JobSearch
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Basic JobSearch component with no initial filters.
        </p>
      </div>
      <JobSearch fetchSuggestions={mockFetchSuggestions} />
    </div>
  ),
};

export const WithInitialFilters: Story = {
  args: {
    initialFilters: [
      {
        id: "1",
        match: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["batch"],
      },
      {
        id: "2",
        match: "queue:",
        typeId: FilterTypeId.QUEUE,
        values: ["default"],
      },
      {
        id: "3",
        match: "priority:",
        typeId: FilterTypeId.PRIORITY,
        values: ["1"],
      },
      {
        id: "4",
        match: "id:",
        typeId: FilterTypeId.ID,
        values: ["123", "456"],
      },
    ],
  },
};

// Component to demonstrate changing filters
const FilterChangeDemo = () => {
  const [_filters, setFilters] = useState<Filter[]>([]);
  const [filterLog, setFilterLog] = useState<string[]>([]);
  const prevFiltersRef = useRef<Filter[]>([]);

  const handleFiltersChange = useCallback((newFilters: Filter[]) => {
    // Skip update if filters haven't actually changed
    if (JSON.stringify(newFilters) === JSON.stringify(prevFiltersRef.current)) {
      return;
    }

    prevFiltersRef.current = newFilters;
    setFilters(newFilters);

    // Create a log entry summarizing the change
    const filterSummary = newFilters
      .map((f) => `${f.match}${f.values.join(",")}`)
      .join("; ");

    setFilterLog((prev) => [
      `Filters updated: ${filterSummary || "none"}`,
      ...prev.slice(0, 4), // Keep last 5 entries
    ]);
  }, []);

  return (
    <div className="w-full p-4">
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Filter Change Logger
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          This demonstrates the filter change callbacks. Try adding, editing,
          and removing filters.
        </p>
      </div>

      <div className="mb-6">
        <JobSearch
          fetchSuggestions={mockFetchSuggestions}
          initialFilters={[
            {
              id: "1",
              match: "kind:",
              typeId: FilterTypeId.KIND,
              values: ["email"],
            },
          ]}
          onFiltersChange={handleFiltersChange}
        />
      </div>

      <div className="mt-8 rounded-md bg-slate-50 p-4 dark:bg-slate-800">
        <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
          Filter Change Log:
        </h3>
        <div className="space-y-1">
          {filterLog.length > 0 ? (
            filterLog.map((entry, i) => (
              <div
                className="border-b border-slate-200 p-1 font-mono text-xs text-gray-800 dark:border-slate-700 dark:text-gray-200"
                key={i}
              >
                {entry}
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              No filter changes yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const WithFilterChangeHandler: Story = {
  render: () => <FilterChangeDemo />,
};

// Component to demonstrate adding duplicate filter types
const DuplicateFilterDemo = () => {
  return (
    <div className="w-full p-4">
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Duplicate Filter Handling
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          This demonstrates how the component handles attempts to add duplicate
          filter types:
          <br />
          1. Add a 'kind:' filter using the dropdown
          <br />
          2. Try to add another 'kind:' filter - it should focus the existing
          one
        </p>
      </div>

      <JobSearch fetchSuggestions={mockFetchSuggestions} />
    </div>
  );
};

export const DuplicateFilters: Story = {
  render: () => <DuplicateFilterDemo />,
};

// Component to demonstrate keyboard interaction
const KeyboardInteractionDemo = () => {
  return (
    <div className="w-full p-4">
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Keyboard Interaction
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          This demonstrates keyboard interaction features:
          <br />
          1. Add a filter, then use keyboard to navigate and select suggestions
          <br />
          2. Use arrow keys to navigate suggestions
          <br />
          3. Press Enter to select the highlighted suggestion
          <br />
          4. Press Enter with no suggestion highlighted to save current value
          <br />
          5. Press Escape to cancel editing
        </p>
      </div>

      <JobSearch
        fetchSuggestions={mockFetchSuggestions}
        initialFilters={[
          {
            id: "1",
            match: "kind:",
            typeId: FilterTypeId.KIND,
            values: ["email"],
          },
        ]}
      />
    </div>
  );
};

export const KeyboardInteraction: Story = {
  render: () => <KeyboardInteractionDemo />,
};

// Component to demonstrate multiple values
const MultiValueDemo = () => {
  return (
    <div className="w-full p-4">
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Multiple Values
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          This demonstrates multiple values in filters:
          <br />
          1. Click on a filter to edit
          <br />
          2. Add multiple comma-separated values
          <br />
          3. Notice how values are sorted and deduplicated when exiting edit
          mode
          <br />
          4. Trailing commas are removed when exiting edit mode
        </p>
      </div>

      <JobSearch
        fetchSuggestions={mockFetchSuggestions}
        initialFilters={[
          {
            id: "1",
            match: "kind:",
            typeId: FilterTypeId.KIND,
            values: ["email"],
          },
          {
            id: "2",
            match: "queue:",
            typeId: FilterTypeId.QUEUE,
            values: ["high-priority"],
          },
        ]}
      />
    </div>
  );
};

export const MultipleValues: Story = {
  render: () => <MultiValueDemo />,
};

export const NarrowWithLongFilters: Story = {
  render: () => (
    <div className="w-80 p-4">
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Narrow JobSearch with Long Filters
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Demonstrates truncation and multiline wrapping of filters with long
          values.
        </p>
      </div>
      <JobSearch
        fetchSuggestions={mockFetchSuggestions}
        initialFilters={[
          {
            id: "1",
            match: "kind:",
            typeId: FilterTypeId.KIND,
            values: [
              "very-long-job-kind-value-that-should-truncate",
              "another-super-long-kind-value-to-test-wrapping",
              "short",
            ],
          },
          {
            id: "2",
            match: "queue:",
            typeId: FilterTypeId.QUEUE,
            values: ["queue-with-a-really-really-long-name-that-will-not-fit"],
          },
        ]}
      />
    </div>
  ),
};
