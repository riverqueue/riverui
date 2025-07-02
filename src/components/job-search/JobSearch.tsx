import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/16/solid";
import clsx from "clsx";
import { useRef } from "react";

import { fetchSuggestions as defaultFetchSuggestions } from "./api";
import { SuggestionsDropdown } from "./components/SuggestionsDropdown";
import { useClickOutside } from "./components/useClickOutside";
import { useKeyboardNavigation } from "./components/useKeyboardNavigation";
import { useFilterInput } from "./hooks";
import { FilterType, JobFilter, JobFilterTypeID } from "./types";

export type { JobFilter as Filter, FilterType };
export { JobFilterTypeID as FilterTypeId };

export interface JobSearchProps {
  /**
   * Class name to apply to the JobSearch component
   */
  className?: string;
  /**
   * Function to fetch suggestions for a filter type
   * @param filterTypeId - The ID of the filter type
   * @param query - The search query
   * @param selectedValues - Values already selected for this filter
   * @returns Promise resolving to an array of suggestion strings
   */
  fetchSuggestions?: (
    filterTypeId: JobFilterTypeID,
    query: string,
    selectedValues: string[],
  ) => Promise<string[]>;
  /**
   * Initial filters to display
   * @default []
   */
  initialFilters?: JobFilter[];
  /**
   * Callback when filters change
   * @param filters - The updated list of filters
   */
  onFiltersChange?: (filters: JobFilter[]) => void;
}

export function JobSearch({
  className,
  fetchSuggestions = defaultFetchSuggestions,
  initialFilters = [],
  onFiltersChange,
}: JobSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    clearSuggestions,
    cursorPosition,
    handleBlur,
    handleClearAll,
    handleColonShortcut,
    handleInputChange,
    handleSelectSuggestion,
    inputValue,
    setCursorPosition,
    setHighlightedIndex,
    suggestionsState,
    updateSuggestions,
  } = useFilterInput({
    fetchSuggestions,
    initialFilters,
    onFiltersChange,
  });

  // Handle clicking outside to close suggestions
  useClickOutside(containerRef, clearSuggestions);

  // Handle input change from React event
  const handleInputChangeEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newCursor = e.target.selectionStart || 0;

    // Check for colon shortcut
    const shortcutFilter = handleColonShortcut(newValue, inputValue.length);
    if (shortcutFilter) {
      handleSuggestionSelect(shortcutFilter);
      return;
    }

    handleInputChange(newValue, newCursor);
  };

  // Handle cursor position changes
  const handleSelectionChange = () => {
    if (inputRef.current) {
      const newCursor = inputRef.current.selectionStart || 0;
      setCursorPosition(newCursor);
      updateSuggestions(inputValue, newCursor);
    }
  };

  // Handle focus to show suggestions
  const handleFocus = () => {
    updateSuggestions(inputValue, cursorPosition);
  };

  // Handle suggestion selection with input focus management
  const handleSuggestionSelect = (suggestion: string) => {
    const result = handleSelectSuggestion(suggestion);

    // Focus input and set cursor position
    if (inputRef.current) {
      inputRef.current.focus();
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(
            result.newCursorPos,
            result.newCursorPos,
          );
          // If we just applied a filter type, immediately show value suggestions
          if (result.shouldShowValueSuggestions) {
            updateSuggestions(result.newText, result.newCursorPos);
          }
        }
      }, 0);
    }
  };

  // Keyboard navigation
  const { handleKeyDown } = useKeyboardNavigation({
    cursorPosition,
    highlightedIndex: suggestionsState.highlightedIndex,
    inputValue,
    onClearAll: handleClearAll,
    onClearSuggestions: clearSuggestions,
    onHighlightChange: setHighlightedIndex,
    onSelectSuggestion: handleSuggestionSelect,
    suggestions: suggestionsState.suggestions,
    suggestionsCount: suggestionsState.suggestions.length,
  });

  const showSuggestions =
    suggestionsState.suggestions.length > 0 || suggestionsState.isLoading;

  return (
    <div className={clsx("w-full", className)} ref={containerRef}>
      <div className="relative">
        {/* Search input container */}
        <div className="relative w-full rounded-md border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex w-full items-stretch">
            {/* Search Icon */}
            <div className="flex items-center pr-1 pl-3">
              <MagnifyingGlassIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-gray-400"
              />
            </div>

            {/* Main input */}
            <div className="flex min-w-0 flex-1 items-center py-2">
              <input
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                className="min-w-0 flex-1 border-none bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:border-none focus:ring-0 dark:text-white"
                data-1p-ignore
                data-form-type="other"
                data-testid="job-search-input"
                onBlur={handleBlur}
                onChange={handleInputChangeEvent}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                onSelect={handleSelectionChange}
                placeholder="Add filter"
                ref={inputRef}
                spellCheck={false}
                type="text"
                value={inputValue}
              />
            </div>

            {/* Clear button */}
            {inputValue && (
              <div className="flex items-center pr-3 pl-1">
                <button
                  className="shrink-0 text-gray-400 hover:text-gray-500"
                  onClick={handleClearAll}
                  type="button"
                >
                  <XMarkIcon aria-hidden="true" className="size-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <SuggestionsDropdown
            highlightedIndex={suggestionsState.highlightedIndex}
            isLoading={suggestionsState.isLoading}
            onHighlightChange={setHighlightedIndex}
            onSelectSuggestion={handleSuggestionSelect}
            suggestions={suggestionsState.suggestions}
          />
        )}
      </div>
    </div>
  );
}
