import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { EditableBadge } from "./EditableBadge";

// Define the filter types
export interface FilterType {
  id: string;
  label: string;
  prefix: string;
  fetchSuggestions: (
    query: string,
    selectedValues: string[],
  ) => Promise<string[]>;
}

// Define the filter instance
export interface Filter {
  id: string;
  typeId: string;
  prefix: string;
  values: string[];
}

// Define the available filter types
export const AVAILABLE_FILTERS: FilterType[] = [
  {
    id: "kind",
    label: "Job Kind",
    prefix: "kind:",
    fetchSuggestions: async (query: string, selectedValues: string[]) => {
      const mockKinds = [
        "batch",
        "stream",
        "scheduled",
        "one-time",
        "recurring",
      ];
      // Ensure selectedValues is an array
      const safeSelectedValues = Array.isArray(selectedValues)
        ? selectedValues
        : [];
      return mockKinds
        .filter((kind) => kind.includes(query.toLowerCase()))
        .filter((kind) => !safeSelectedValues.includes(kind));
    },
  },
  {
    id: "queue",
    label: "Queue",
    prefix: "queue:",
    fetchSuggestions: async (query: string, selectedValues: string[]) => {
      const mockQueues = [
        "default",
        "high-priority",
        "low-priority",
        "batch",
        "realtime",
      ];
      const safeSelectedValues = Array.isArray(selectedValues)
        ? selectedValues
        : [];
      return mockQueues
        .filter((queue) => queue.includes(query.toLowerCase()))
        .filter((queue) => !safeSelectedValues.includes(queue));
    },
  },
  {
    id: "priority",
    label: "Priority",
    prefix: "priority:",
    fetchSuggestions: async (query: string, selectedValues: string[]) => {
      const priorities = ["1", "2", "3", "4"];
      const safeSelectedValues = Array.isArray(selectedValues)
        ? selectedValues
        : [];
      return priorities
        .filter((priority) => priority.includes(query))
        .filter((priority) => !safeSelectedValues.includes(priority));
    },
  },
];

export interface JobSearchProps {
  /**
   * Callback when filters change
   * @param filters - The updated list of filters
   */
  onFiltersChange?: (filters: Filter[]) => void;
  /**
   * Initial filters to display
   * @default []
   */
  initialFilters?: Filter[];
}

export function JobSearch({
  onFiltersChange,
  initialFilters = [],
}: JobSearchProps) {
  // The current search query
  const [query, setQuery] = useState("");
  // The list of active filters
  const [filters, setFilters] = useState<Filter[]>(initialFilters);
  // ID of the filter currently being edited, or null if none
  const [editingFilterId, setEditingFilterId] = useState<null | string>(null);
  // Whether to show the filter type dropdown
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  // The current editing value and its index
  const [editingValue, setEditingValue] = useState<{
    index: number;
    value: string;
  } | null>(null);
  // Suggestions for the autocomplete dropdown
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Whether suggestions are being loaded
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  // The currently selected suggestion
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(
    null,
  );
  // Whether a suggestion has been applied
  const [suggestionApplied, setSuggestionApplied] = useState<boolean>(false);
  // Index of the highlighted suggestion for keyboard navigation
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Notify parent when filters change
  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  // Clear editing state after suggestion is applied
  useEffect(() => {
    if (suggestionApplied && editingValue) {
      setEditingValue(null);
      setSuggestions([]);
      setSelectedSuggestion(null);
      setSuggestionApplied(false);
    }
  }, [suggestionApplied, editingValue]);

  // Reset highlightedIndex when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  // Update the filters when the content of a badge changes
  const handleFilterContentChange = (id: string, values: string[]) => {
    setFilters((prev) =>
      prev.map((filter) => (filter.id === id ? { ...filter, values } : filter)),
    );
  };

  // Fetch suggestions for the current editing value
  const handleEditingValueChange = async (value: string, index: number) => {
    setEditingValue({ index, value });
    const currentFilter = filters.find((f) => f.id === editingFilterId);
    if (!currentFilter) return;

    const filterType = AVAILABLE_FILTERS.find(
      (ft) => ft.id === currentFilter.typeId,
    );
    if (!filterType) return;

    setIsLoadingSuggestions(true);
    try {
      const newSuggestions = await filterType.fetchSuggestions(
        value,
        currentFilter.values,
      );
      setSuggestions(newSuggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Remove a filter by its ID
  const handleRemoveFilter = (id: string) => {
    setFilters((prev) => prev.filter((filter) => filter.id !== id));
  };

  // Add a new filter of the specified type
  const handleAddFilter = (filterType: FilterType) => {
    // If a filter of this type already exists, focus it instead of adding new
    const existing = filters.find((f) => f.typeId === filterType.id);
    if (existing) {
      setEditingFilterId(existing.id);
      setShowFilterDropdown(false);
      // Reset suggestion related state so EditableBadge can fetch fresh suggestions
      setEditingValue(null);
      setSuggestions([]);
      setSelectedSuggestion(null);
      return;
    }

    const newFilter: Filter = {
      id: Math.random().toString(36).substr(2, 9),
      typeId: filterType.id,
      prefix: filterType.prefix,
      values: [],
    };
    setFilters((prev) => [...prev, newFilter]);
    setEditingFilterId(newFilter.id);
    setShowFilterDropdown(false);
  };

  // Select a suggestion from the autocomplete list
  const handleSelectSuggestion = (suggestion: string) => {
    if (!editingValue) return;
    const currentFilter = filters.find((f) => f.id === editingFilterId);
    if (!currentFilter) return;

    const newValues = [...currentFilter.values];
    if (editingValue.index >= 0 && editingValue.index < newValues.length) {
      newValues[editingValue.index] = suggestion;
    } else {
      newValues.push(suggestion);
    }

    setFilters((prev) =>
      prev.map((filter) =>
        filter.id === editingFilterId
          ? { ...filter, values: newValues }
          : filter,
      ),
    );
    setSelectedSuggestion(suggestion);
  };

  return (
    <div className="w-full" ref={containerRef}>
      <div className="relative">
        {/* Search input and filters container */}
        <div className="relative flex min-h-[38px] w-full items-center rounded-md border border-gray-300 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-1 flex-wrap items-center gap-2 px-3 py-1.5">
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-gray-400"
            />
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {filters.map((filter) => (
                <EditableBadge
                  color="zinc"
                  content={filter.values}
                  isEditing={editingFilterId === filter.id}
                  key={filter.id}
                  onContentChange={(values) =>
                    handleFilterContentChange(filter.id, values)
                  }
                  onEditComplete={() => {
                    setEditingFilterId(null);
                    setEditingValue(null);
                    setSuggestions([]);
                    setSelectedSuggestion(null);
                    setSuggestionApplied(false);
                  }}
                  onEditingValueChange={handleEditingValueChange}
                  onEditStart={() => {
                    setEditingFilterId(filter.id);
                    setShowFilterDropdown(false);
                  }}
                  onRemove={() => handleRemoveFilter(filter.id)}
                  prefix={filter.prefix}
                  selectedSuggestion={
                    editingFilterId === filter.id ? selectedSuggestion : null
                  }
                  onSuggestionApplied={() => setSuggestionApplied(true)}
                  onSuggestionKeyDown={(e) => {
                    if (!editingValue || suggestions.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedIndex((prev) =>
                        prev + 1 < suggestions.length ? prev + 1 : 0,
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedIndex((prev) =>
                        prev - 1 >= 0 ? prev - 1 : suggestions.length - 1,
                      );
                    } else if (e.key === "Enter") {
                      if (
                        highlightedIndex >= 0 &&
                        highlightedIndex < suggestions.length
                      ) {
                        e.preventDefault();
                        handleSelectSuggestion(suggestions[highlightedIndex]);
                      }
                    }
                  }}
                  fetchSuggestions={async (query: string) => {
                    const filterType = AVAILABLE_FILTERS.find(
                      (ft) => ft.id === filter.typeId,
                    );
                    if (!filterType) return [];
                    return filterType.fetchSuggestions(query, filter.values);
                  }}
                />
              ))}
              <input
                className="min-w-[80px] flex-1 border-none bg-transparent text-gray-900 placeholder:text-gray-400 focus:border-none focus:ring-0 dark:text-white"
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => !editingFilterId && setShowFilterDropdown(true)}
                placeholder="Add filter"
                type="text"
                value={query}
              />
            </div>
            {(filters.length > 0 || query) && (
              <button
                className="shrink-0 text-gray-400 hover:text-gray-500"
                onClick={() => {
                  setFilters([]);
                  setQuery("");
                  setShowFilterDropdown(false);
                }}
                type="button"
              >
                <XMarkIcon aria-hidden="true" className="size-5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Type Dropdown */}
        {showFilterDropdown && (
          <div className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="p-2">
              <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                Click to add a filter
              </div>
              <div className="space-y-1">
                {AVAILABLE_FILTERS.map((filterType) => (
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                    key={filterType.id}
                    onClick={() => handleAddFilter(filterType)}
                  >
                    <span className="size-2 rounded-full bg-zinc-500" />
                    {filterType.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Autocomplete Dropdown */}
        {editingValue && (
          <div className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="p-2">
              <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                {isLoadingSuggestions
                  ? "Loading suggestions..."
                  : suggestions.length > 0
                    ? `Suggestions for "${editingValue.value}"`
                    : "No suggestions found"}
              </div>
              <div className="space-y-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    className={clsx(
                      "flex w-full items-center rounded-md px-2 py-1 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700",
                      highlightedIndex >= 0 &&
                        index === highlightedIndex &&
                        "bg-gray-100 dark:bg-gray-700",
                    )}
                    key={suggestion}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(suggestion);
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
