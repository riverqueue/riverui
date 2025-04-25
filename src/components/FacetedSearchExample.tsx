import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/16/solid";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { BadgeColors } from "./Badge";
import { EditableBadge, EditableValue } from "./EditableBadge";

interface Filter {
  color: string;
  id: string;
  prefix: string;
  values: string[];
}

const AVAILABLE_FILTERS = [
  { color: "blue", id: "kind", label: "Job Kind", prefix: "kind:" },
  { color: "green", id: "location", label: "Location", prefix: "location:" },
  { color: "purple", id: "salary", label: "Salary Range", prefix: "salary:" },
  { color: "orange", id: "skills", label: "Skills", prefix: "skills:" },
  {
    color: "red",
    id: "experience",
    label: "Experience",
    prefix: "experience:",
  },
] as const;

export function FacetedSearchExample() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filter[]>([
    {
      color: "blue",
      id: "1",
      prefix: "kind:",
      values: ["full-time", "contract"],
    },
    { color: "green", id: "2", prefix: "location:", values: ["remote", "us"] },
  ]);
  const [editingFilterId, setEditingFilterId] = useState<null | string>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [editingValue, setEditingValue] = useState<{
    index: number;
    value: string;
  } | null>(null);
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

  const handleFilterContentChange = (
    id: string,
    editableValue: EditableValue,
  ) => {
    setFilters((prev) =>
      prev.map((filter) =>
        filter.id === id ? { ...filter, values: editableValue.values } : filter,
      ),
    );
  };

  const handleEditingValueChange = (value: string, index: number) => {
    setEditingValue({ index, value });
    // Here you would typically trigger your autocomplete logic
    console.log(`Editing value ${value} at index ${index}`);
  };

  const handleRemoveFilter = (id: string) => {
    setFilters(filters.filter((filter) => filter.id !== id));
  };

  const handleAddFilter = (filterType: (typeof AVAILABLE_FILTERS)[number]) => {
    const newFilter: Filter = {
      color: filterType.color,
      id: Math.random().toString(36).substr(2, 9),
      prefix: filterType.prefix,
      values: [],
    };
    setFilters([...filters, newFilter]);
    setEditingFilterId(newFilter.id);
    setShowFilterDropdown(false);
  };

  return (
    <div className="w-full max-w-2xl" ref={containerRef}>
      <div className="relative">
        <div className="relative flex min-h-[38px] w-full items-center rounded-md border border-gray-300 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-1 flex-wrap items-center gap-2 px-3 py-1.5">
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-gray-400"
            />

            <div className="flex flex-1 flex-wrap items-center gap-2">
              {filters.map((filter) => (
                <EditableBadge
                  color={filter.color as (typeof BadgeColors)[number]}
                  content={filter.values}
                  isEditing={editingFilterId === filter.id}
                  key={filter.id}
                  onContentChange={(editableValue) =>
                    handleFilterContentChange(filter.id, editableValue)
                  }
                  onEditComplete={() => {
                    setEditingFilterId(null);
                    setEditingValue(null);
                  }}
                  onEditingValueChange={handleEditingValueChange}
                  onEditStart={() => {
                    setEditingFilterId(filter.id);
                    setShowFilterDropdown(false);
                  }}
                  onRemove={() => handleRemoveFilter(filter.id)}
                  prefix={filter.prefix}
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
                    <span
                      className={clsx(
                        "size-2 rounded-full",
                        filterType.color === "blue" && "bg-blue-500",
                        filterType.color === "green" && "bg-green-500",
                        filterType.color === "purple" && "bg-purple-500",
                        filterType.color === "orange" && "bg-orange-500",
                        filterType.color === "red" && "bg-red-500",
                      )}
                    />
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
                Suggestions for "{editingValue.value}"
              </div>
              {/* Add your autocomplete suggestions here */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
