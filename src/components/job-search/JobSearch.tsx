import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/16/solid";
import clsx from "clsx";
import {
  Dispatch,
  KeyboardEvent,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

import { fetchSuggestions as defaultFetchSuggestions } from "./api";
import { EditableBadge } from "./EditableBadge";
import {
  AVAILABLE_FILTERS,
  FilterType,
  JobFilter,
  JobFilterTypeID,
} from "./types";

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

// Type for actions that can be dispatched to the reducer
type JobSearchAction =
  | {
      payload: { cursorPos: null | number; value: string };
      type: "SET_RAW_EDITING_VALUE";
    }
  | { payload: { id: string; values: string[] }; type: "UPDATE_FILTER_VALUES" }
  | { payload: { index: number; value: string }; type: "SET_EDITING_VALUE" }
  | { payload: boolean; type: "SET_LOADING_SUGGESTIONS" }
  | { payload: boolean; type: "TOGGLE_FILTER_DROPDOWN" }
  | { payload: FilterType; type: "ADD_FILTER" }
  | { payload: JobFilter; type: "EDIT_FILTER" }
  | { payload: number; type: "SET_HIGHLIGHTED_INDEX" }
  | { payload: string; type: "REMOVE_FILTER" }
  | { payload: string; type: "SET_QUERY" }
  | { payload: string; type: "START_EDITING_FILTER" }
  | { payload: string[]; type: "SET_SUGGESTIONS" }
  | { type: "ENTER_SUGGESTION_SELECTED_MODE" }
  | { type: "ENTER_TYPING_MODE" }
  | { type: "RESET_ALL" }
  | { type: "STOP_EDITING_FILTER" };

// Type for the state managed by the reducer
interface JobSearchState {
  editingFilter: {
    editingCursorPos: null | number;
    editingMode: "IDLE" | "SUGGESTION_SELECTED" | "TYPING";
    editingValue: null | string;
    filterId: null | string;
    highlightedIndex: number;
    isLoadingSuggestions: boolean;
    showFilterDropdown: boolean;
    suggestions: string[];
  };
  filters: JobFilter[];
  query: string;
}

// Utility to finalize edit value
const finalizeEditValue = (value: null | string): string[] => {
  if (value === null) return [];
  const uniq = Array.from(
    new Set(
      value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  );
  return [...uniq].sort();
};

// Function to find the token index at a given cursor position
const getTokenIndexAtCursor = (
  value: string,
  cursorPos: null | number,
): number => {
  // Handle cursor at or past the end first
  if (cursorPos === null || cursorPos >= value.length) {
    const parts = value.split(",");
    return parts.length - 1; // Always the index of the last part (even if empty)
  }

  // If cursor is within the string, count preceding commas
  // The number of commas before the cursor determines the token index
  const commasBeforeCursor =
    value.substring(0, cursorPos).match(/,/g)?.length ?? 0;
  return commasBeforeCursor;
};

// Reducer function
const jobSearchReducer = (
  state: JobSearchState,
  action: JobSearchAction,
): JobSearchState => {
  switch (action.type) {
    case "ADD_FILTER": {
      const existing = state.filters.find(
        (f) => f.typeId === action.payload.id,
      );
      if (existing) {
        // Start editing existing filter
        const editingValue =
          existing.values.join(",") + (existing.values.length > 0 ? "," : "");
        return {
          ...state,
          editingFilter: {
            ...state.editingFilter,
            editingCursorPos: null,
            editingMode: "TYPING",
            editingValue: editingValue,
            filterId: existing.id,
            isLoadingSuggestions: true, // Start loading suggestions
            showFilterDropdown: false,
            suggestions: [], // Clear suggestions initially
          },
          filters: state.filters, // Don't modify filters when editing existing
        };
      }

      // Add new filter and start editing
      const newFilter: JobFilter = {
        id: Math.random().toString(36).substr(2, 9),
        prefix: action.payload.prefix,
        typeId: action.payload.id,
        values: [],
      };
      const newFilters = [...state.filters, newFilter];
      return {
        ...state,
        editingFilter: {
          ...state.editingFilter,
          editingCursorPos: null,
          editingMode: "TYPING",
          editingValue: "", // Start with empty value for new filter
          filterId: newFilter.id,
          isLoadingSuggestions: true, // Start loading suggestions
          showFilterDropdown: false,
          suggestions: [], // Clear suggestions initially
        },
        filters: newFilters,
      };
    }

    case "EDIT_FILTER": {
      const filterToEdit2 = state.filters.find(
        (f) => f.id === action.payload.id,
      );
      if (!filterToEdit2) return state; // Should not happen
      const editingValue2 =
        action.payload.values.join(",") +
        (action.payload.values.length > 0 ? "," : "");
      return {
        ...state,
        editingFilter: {
          ...state.editingFilter,
          editingCursorPos: null,
          editingMode: "TYPING",
          editingValue: editingValue2,
          filterId: action.payload.id,
          highlightedIndex: -1,
          isLoadingSuggestions: true, // Start loading suggestions
          showFilterDropdown: false,
          suggestions: [],
        },
        filters: state.filters.map((filter) =>
          filter.id === action.payload.id
            ? { ...filter, values: action.payload.values }
            : filter,
        ),
      };
    }

    case "ENTER_SUGGESTION_SELECTED_MODE":
      return {
        ...state,
        editingFilter: {
          ...state.editingFilter,
          editingMode: "SUGGESTION_SELECTED",
        },
      };

    case "ENTER_TYPING_MODE":
      return {
        ...state,
        editingFilter: {
          ...state.editingFilter,
          editingMode: "TYPING",
        },
      };

    case "REMOVE_FILTER": {
      // If removing the filter being edited, stop editing
      const stopEditing = state.editingFilter.filterId === action.payload;
      return {
        ...state,
        editingFilter: stopEditing
          ? {
              // Reset editing state
              ...state.editingFilter,
              editingMode: "IDLE",
              editingValue: null,
              filterId: null,
              highlightedIndex: -1,
              isLoadingSuggestions: false,
              suggestions: [],
            }
          : state.editingFilter,
        filters: state.filters.filter((filter) => filter.id !== action.payload),
      };
    }

    case "RESET_ALL":
      return {
        ...state,
        editingFilter: {
          // Reset editing state
          ...state.editingFilter,
          editingMode: "IDLE",
          editingValue: null,
          filterId: null,
          highlightedIndex: -1,
          isLoadingSuggestions: false,
          showFilterDropdown: false,
          suggestions: [],
        },
        filters: [],
        query: "",
      };

    case "SET_HIGHLIGHTED_INDEX":
      return {
        ...state,
        editingFilter: {
          ...state.editingFilter,
          highlightedIndex: action.payload,
        },
      };

    case "SET_LOADING_SUGGESTIONS":
      return {
        ...state,
        editingFilter: {
          ...state.editingFilter,
          isLoadingSuggestions: action.payload,
        },
      };

    case "SET_QUERY":
      return { ...state, query: action.payload };

    case "SET_RAW_EDITING_VALUE":
      return {
        ...state,
        editingFilter: {
          ...state.editingFilter,
          editingCursorPos: action.payload.cursorPos,
          editingValue: action.payload.value,
        },
      };

    case "SET_SUGGESTIONS":
      return {
        ...state,
        editingFilter: {
          ...state.editingFilter,
          highlightedIndex: -1,
          isLoadingSuggestions: false,
          suggestions: action.payload,
        },
      };

    case "START_EDITING_FILTER": {
      const filterToEdit = state.filters.find((f) => f.id === action.payload);
      if (!filterToEdit) return state; // Should not happen
      const editingValue =
        filterToEdit.values.join(",") +
        (filterToEdit.values.length > 0 ? "," : "");
      return {
        ...state,
        editingFilter: {
          ...state.editingFilter,
          editingCursorPos: editingValue.length, // Set cursor to end, after the comma
          editingMode: "TYPING",
          editingValue: editingValue,
          filterId: action.payload,
          isLoadingSuggestions: true, // Start loading suggestions for the existing value
          showFilterDropdown: false,
          suggestions: [], // Clear suggestions initially
        },
      };
    }

    case "STOP_EDITING_FILTER": {
      if (!state.editingFilter.filterId) return state; // Not editing
      const finalizedValues = finalizeEditValue(
        state.editingFilter.editingValue,
      );
      const filterIdToUpdate = state.editingFilter.filterId;
      return {
        ...state,
        editingFilter: {
          // Reset editing state
          ...state.editingFilter,
          editingMode: "IDLE",
          editingValue: null,
          filterId: null,
          highlightedIndex: -1,
          isLoadingSuggestions: false,
          suggestions: [],
        },
        filters: state.filters.map((filter) =>
          filter.id === filterIdToUpdate
            ? { ...filter, values: finalizedValues }
            : filter,
        ),
      };
    }

    case "TOGGLE_FILTER_DROPDOWN":
      // Prevent opening if editing a filter
      if (state.editingFilter.filterId) return state;
      return {
        ...state,
        editingFilter: {
          ...state.editingFilter,
          showFilterDropdown: action.payload,
        },
      };

    case "UPDATE_FILTER_VALUES": // Keep for potential external updates
      return {
        ...state,
        filters: state.filters.map((filter) =>
          filter.id === action.payload.id
            ? { ...filter, values: action.payload.values }
            : filter,
        ),
      };

    default:
      return state;
  }
};

// Component for rendering the autocomplete suggestions dropdown
const SuggestionsDropdown = ({
  editingState,
  handleSelectSuggestion,
  setHighlightedIndex,
}: {
  editingState: {
    editingValue: null | string;
    filterId: null | string;
    highlightedIndex: number;
    isLoadingSuggestions: boolean;
    showFilterDropdown: boolean;
    suggestions: string[];
  };
  handleSelectSuggestion: (suggestion: string) => void;
  setHighlightedIndex: (index: number) => void;
}) => (
  <div
    className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
    data-testid="suggestions-dropdown"
  >
    <div className="p-2">
      <div className="space-y-1" data-testid="suggestions-list">
        {editingState.isLoadingSuggestions && (
          <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            Loading suggestions...
          </div>
        )}
        {editingState.suggestions.length === 0 &&
          !editingState.isLoadingSuggestions && (
            <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              No suggestions found
            </div>
          )}
        <div className="space-y-1">
          {editingState.suggestions.map((suggestion: string, index: number) => (
            <button
              className={clsx(
                "flex w-full items-center rounded-md px-2 py-1 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700",
                editingState.highlightedIndex >= 0 &&
                  index === editingState.highlightedIndex &&
                  "bg-gray-100 dark:bg-gray-700",
              )}
              data-testid={`suggestion-${suggestion}`}
              key={suggestion}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectSuggestion(suggestion);
              }}
              onMouseEnter={() => {
                setHighlightedIndex(index);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Utility function to handle keyboard navigation for suggestions
const handleSuggestionKeyDown = (
  e: KeyboardEvent,
  editingState: {
    editingValue: null | string;
    filterId: null | string;
    highlightedIndex: number;
    isLoadingSuggestions: boolean;
    showFilterDropdown: boolean;
    suggestions: string[];
  },
  dispatch: Dispatch<JobSearchAction>,
  handleSelectSuggestion: (suggestion: string) => void,
) => {
  if (editingState.suggestions.length === 0) return false;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    const newIndex =
      editingState.highlightedIndex === -1
        ? 0
        : (editingState.highlightedIndex + 1) % editingState.suggestions.length;
    dispatch({
      payload: newIndex,
      type: "SET_HIGHLIGHTED_INDEX",
    });
    return true;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const newIndex =
      editingState.highlightedIndex === -1
        ? editingState.suggestions.length - 1
        : (editingState.highlightedIndex -
            1 +
            editingState.suggestions.length) %
          editingState.suggestions.length;
    dispatch({
      payload: newIndex,
      type: "SET_HIGHLIGHTED_INDEX",
    });
    return true;
  } else if (e.key === "Enter") {
    if (
      editingState.highlightedIndex >= 0 &&
      editingState.highlightedIndex < editingState.suggestions.length
    ) {
      // A suggestion is specifically highlighted, select it
      e.preventDefault();
      handleSelectSuggestion(
        editingState.suggestions[editingState.highlightedIndex],
      );
      return true;
    } else if (
      editingState.suggestions.length > 0 &&
      editingState.editingValue !== null
    ) {
      // Get the token at cursor position
      const input = e.target as HTMLInputElement;
      const cursorPos = input.selectionStart || 0;
      const value = editingState.editingValue;

      // Find the token at cursor position
      const tokens = value.split(",");
      let currentIndex = 0;
      let tokenIndex = -1;

      // Determine which token the cursor is in
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        currentIndex += token.length;

        if (cursorPos <= currentIndex) {
          tokenIndex = i;
          break;
        }

        // Add 1 for the comma
        currentIndex += 1;

        if (cursorPos <= currentIndex) {
          // Cursor is right after a comma, this is the next token
          tokenIndex = i + 1;
          break;
        }
      }

      // If we didn't find it, it's the last token
      if (tokenIndex === -1) {
        tokenIndex = tokens.length - 1;
      }

      // Get the current token
      const currentToken = tokens[tokenIndex] ? tokens[tokenIndex].trim() : "";

      // Only auto-select if the current token has content
      if (currentToken !== "") {
        e.preventDefault();
        handleSelectSuggestion(editingState.suggestions[0]);
        return true;
      }
    }
  }
  return false;
};

export function JobSearch({
  className,
  fetchSuggestions = defaultFetchSuggestions,
  initialFilters = [],
  onFiltersChange,
}: JobSearchProps) {
  // Initialize the state with reducer
  const [state, dispatch] = useReducer(jobSearchReducer, {
    editingFilter: {
      editingCursorPos: null,
      editingMode: "IDLE",
      editingValue: null,
      filterId: null,
      highlightedIndex: -1,
      isLoadingSuggestions: false,
      showFilterDropdown: false,
      suggestions: [],
    },
    filters: initialFilters,
    query: "",
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [filterTypeSuggestions, setFilterTypeSuggestions] = useState<
    FilterType[]
  >([]);
  const [filterTypeDropdownOpen, setFilterTypeDropdownOpen] = useState(false);
  const [filterTypeHighlightedIndex, setFilterTypeHighlightedIndex] =
    useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle clicking outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        dispatch({ payload: false, type: "TOGGLE_FILTER_DROPDOWN" });
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Notify parent when filters change
  useEffect(() => {
    onFiltersChange?.(state.filters);
  }, [state.filters, onFiltersChange]);

  // Notify parent when editing filter values change
  useEffect(() => {
    if (
      state.editingFilter.filterId &&
      state.editingFilter.editingValue !== null
    ) {
      const finalizedValues = finalizeEditValue(
        state.editingFilter.editingValue,
      );
      const updatedFilters = state.filters.map((filter) =>
        filter.id === state.editingFilter.filterId
          ? { ...filter, values: finalizedValues }
          : filter,
      );
      onFiltersChange?.(updatedFilters);
    }
  }, [
    state.editingFilter.editingValue,
    state.editingFilter.filterId,
    state.filters,
    onFiltersChange,
  ]);

  // Handles raw value change from EditableBadge input
  const handleRawValueChange = useCallback(
    async (newValue: string, cursorPos: null | number) => {
      // Update the raw editing value and cursor position in state immediately
      dispatch({
        payload: { cursorPos, value: newValue },
        type: "SET_RAW_EDITING_VALUE",
      });

      const currentFilterId = state.editingFilter.filterId;
      if (!currentFilterId) return; // Not editing a filter

      const currentFilter = state.filters.find((f) => f.id === currentFilterId);
      if (!currentFilter) return;

      // Disable autocomplete for Job ID filter
      if (currentFilter.typeId === JobFilterTypeID.ID) {
        dispatch({ payload: [], type: "SET_SUGGESTIONS" });
        return;
      }

      // Determine the token being edited based on cursor position
      const tokenIndex = getTokenIndexAtCursor(newValue, cursorPos);
      const parts = newValue.split(",");
      const currentToken = parts[tokenIndex]?.trim() ?? "";

      // Generate exclusion list based on *other* tokens
      const existingTokens = parts
        .filter((_, index) => index !== tokenIndex)
        .map((s) => s.trim())
        .filter(Boolean);

      // Transition back to TYPING mode if the user edits the input after selection
      if (
        state.editingFilter.editingMode === "SUGGESTION_SELECTED" &&
        newValue !== state.editingFilter.editingValue
      ) {
        dispatch({ type: "ENTER_TYPING_MODE" });
      }

      // Determine if we should fetch suggestions based on editing mode
      const shouldFetch =
        (state.editingFilter.editingMode === "TYPING" ||
          (state.editingFilter.editingMode === "SUGGESTION_SELECTED" &&
            newValue !== state.editingFilter.editingValue)) &&
        // Fetch suggestions for the current token or if ready for a new value
        (currentToken !== "" ||
          parts[tokenIndex] === "" ||
          newValue.endsWith(",") ||
          newValue === "");

      if (shouldFetch) {
        dispatch({ payload: true, type: "SET_LOADING_SUGGESTIONS" });
        try {
          const newSuggestions = await fetchSuggestions(
            currentFilter.typeId,
            currentToken, // Fetch based on the current token at cursor position
            existingTokens,
          );
          // Only update if still editing the same filter
          if (state.editingFilter.filterId === currentFilterId) {
            dispatch({ payload: newSuggestions, type: "SET_SUGGESTIONS" });
          }
        } catch (_error) {
          if (state.editingFilter.filterId === currentFilterId) {
            dispatch({ payload: [], type: "SET_SUGGESTIONS" });
          }
        }
        // No finally needed as SET_SUGGESTIONS handles loading state
      } else {
        // Clear suggestions if not fetching
        dispatch({ payload: [], type: "SET_SUGGESTIONS" });
      }
    },
    [
      dispatch,
      state.filters, // Need filters to get typeId
      state.editingFilter.filterId, // Need filterId to check if still editing
      state.editingFilter.editingMode, // Depend on editing mode
      state.editingFilter.editingValue, // Added to resolve ESLint warning
      fetchSuggestions,
    ],
  );

  // Fetch initial suggestions when editing starts
  useEffect(() => {
    const currentFilterId = state.editingFilter.filterId;
    if (currentFilterId && state.editingFilter.editingValue !== null) {
      // Call handleRawValueChange to trigger fetch for the current editing value
      handleRawValueChange(
        state.editingFilter.editingValue,
        state.editingFilter.editingCursorPos,
      );
    }
  }, [
    state.editingFilter.filterId,
    state.editingFilter.editingValue,
    state.editingFilter.editingCursorPos,
    handleRawValueChange,
  ]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = (suggestion: string) => {
    // Calculate the new value based on current state
    const currentValue = state.editingFilter.editingValue ?? "";
    const cursorPos = state.editingFilter.editingCursorPos;
    const tokenIndex = getTokenIndexAtCursor(currentValue, cursorPos);
    const parts = currentValue.split(",");

    if (tokenIndex < 0 || tokenIndex >= parts.length) {
      // Log the values to understand why index might be invalid
      console.warn("handleSelectSuggestion: Invalid token index", {
        currentValue,
        cursorPos,
        parts, // Add parts for debugging
        tokenIndex,
      });
      return;
    }

    const trimmedSuggestion = suggestion.trim();

    // --- Revised token replacement logic ---
    // Create a new array of parts
    const newParts = [...parts];

    // Replace the token at the calculated index
    newParts[tokenIndex] = trimmedSuggestion;

    // Join the parts back together
    const newValue = newParts.join(",");

    // Calculate new cursor position after the replaced token
    let newCursorPos = 0;
    for (let i = 0; i <= tokenIndex; i++) {
      newCursorPos += newParts[i].length;
      if (i < tokenIndex) {
        newCursorPos++; // Add 1 for the comma
      }
    }
    // --- End revised logic ---

    // Directly dispatch state updates
    dispatch({
      payload: { cursorPos: newCursorPos, value: newValue },
      type: "SET_RAW_EDITING_VALUE",
    });
    dispatch({ payload: [], type: "SET_SUGGESTIONS" }); // Clear suggestions
    dispatch({ type: "ENTER_SUGGESTION_SELECTED_MODE" }); // Set mode to prevent immediate autocomplete
  };

  // Helper: filter AVAILABLE_FILTERS by query
  const getFilteredFilterTypes = (query: string) => {
    const q = query.trim().toLowerCase();
    return AVAILABLE_FILTERS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.prefix.toLowerCase().startsWith(q),
    );
  };

  // Helper: check if query matches a filter type + ':'
  const getFilterTypeByColonShortcut = (query: string) => {
    const q = query.trim().toLowerCase();
    return AVAILABLE_FILTERS.find(
      (f) => q === f.label.toLowerCase() + ":" || q === f.prefix.toLowerCase(),
    );
  };

  // Handle input change for filter type selection
  const handleFilterTypeInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    dispatch({ payload: value, type: "SET_QUERY" });
    if (state.editingFilter.filterId) return; // Don't show filter type dropdown if editing a filter
    if (value === "") {
      setFilterTypeSuggestions([]);
      setFilterTypeDropdownOpen(false);
      setFilterTypeHighlightedIndex(0);
      return;
    }
    // Colon shortcut
    const colonMatch = getFilterTypeByColonShortcut(value);
    if (colonMatch) {
      dispatch({ payload: colonMatch, type: "ADD_FILTER" });
      dispatch({ payload: "", type: "SET_QUERY" });
      setFilterTypeSuggestions([]);
      setFilterTypeDropdownOpen(false);
      setFilterTypeHighlightedIndex(0);
      return;
    }
    const filtered = getFilteredFilterTypes(value);
    setFilterTypeSuggestions(filtered);
    setFilterTypeDropdownOpen(true);
    setFilterTypeHighlightedIndex(0);
  };

  // Handle keyboard navigation for filter type suggestions
  const handleFilterTypeInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (!filterTypeDropdownOpen || filterTypeSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFilterTypeHighlightedIndex(
        (prev) => (prev + 1) % filterTypeSuggestions.length,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFilterTypeHighlightedIndex(
        (prev) =>
          (prev - 1 + filterTypeSuggestions.length) %
          filterTypeSuggestions.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filterTypeSuggestions[filterTypeHighlightedIndex];
      if (selected) {
        // Check if a filter with this typeId already exists to prevent duplicate dispatches
        const existing = state.filters.find((f) => f.typeId === selected.id);
        if (!existing) {
          dispatch({ payload: selected, type: "ADD_FILTER" });
        } else {
          // If filter exists, start editing it
          dispatch({ payload: existing.id, type: "START_EDITING_FILTER" });
        }
        dispatch({ payload: "", type: "SET_QUERY" });
        setFilterTypeSuggestions([]);
        setFilterTypeDropdownOpen(false);
        setFilterTypeHighlightedIndex(0);
      }
    } else if (e.key === "Escape") {
      setFilterTypeSuggestions([]);
      setFilterTypeDropdownOpen(false);
      setFilterTypeHighlightedIndex(0);
      dispatch({ payload: "", type: "SET_QUERY" });
      inputRef.current?.blur();
    }
  };

  // Handle blur event to clear input if no selection is made
  const handleFilterTypeInputBlur = () => {
    setFilterTypeSuggestions([]);
    setFilterTypeDropdownOpen(false);
    setFilterTypeHighlightedIndex(0);
    dispatch({ payload: "", type: "SET_QUERY" });
  };

  // Handle clicking a filter type suggestion
  const handleSelectFilterTypeSuggestion = (suggestion: string) => {
    const selected = filterTypeSuggestions.find(
      (f) => f.label === suggestion || f.prefix === suggestion,
    );
    if (selected) {
      // Check if a filter with this typeId already exists to prevent duplicate dispatches
      const existing = state.filters.find((f) => f.typeId === selected.id);
      if (!existing) {
        dispatch({ payload: selected, type: "ADD_FILTER" });
      } else {
        // If filter exists, start editing it
        dispatch({ payload: existing.id, type: "START_EDITING_FILTER" });
      }
      dispatch({ payload: "", type: "SET_QUERY" });
      setFilterTypeSuggestions([]);
      setFilterTypeDropdownOpen(false);
      setFilterTypeHighlightedIndex(0);
    } else {
      console.log("No matching filter type found for suggestion:", suggestion);
    }
  };

  // Handle navigating between filters
  const handleNavigatePreviousFilter = useCallback(
    (_e: CustomEvent) => {
      if (state.editingFilter.filterId) {
        const currentIndex = state.filters.findIndex(
          (f) => f.id === state.editingFilter.filterId,
        );
        if (currentIndex > 0) {
          const previousFilter = state.filters[currentIndex - 1];
          // We need to be careful about the cursor position when moving between filters
          // First, stop editing the current filter
          dispatch({ type: "STOP_EDITING_FILTER" });
          // Then start editing the previous filter
          dispatch({
            payload: previousFilter.id,
            type: "START_EDITING_FILTER",
          });

          // Immediately set cursor position at the end of the previous filter's value
          const value =
            previousFilter.values.join(",") +
            (previousFilter.values.length > 0 ? "," : "");
          setTimeout(() => {
            const input = document.querySelector(
              `[data-testid="filter-badge-${previousFilter.typeId}"] input`,
            ) as HTMLInputElement;
            if (input) {
              input.focus();
              // Explicitly set the value and cursor position
              if (input.value !== value) {
                input.value = value;
              }
              const valueLength = value.length;
              input.setSelectionRange(valueLength, valueLength);
            }
          }, 10); // Small delay to ensure DOM is updated
        } else {
          // If at the first filter, simply maintain cursor at position 0
          // without changing the current filter state or value
          setTimeout(() => {
            const currentFilter = state.filters[currentIndex];
            const input = document.querySelector(
              `[data-testid="filter-badge-${currentFilter.typeId}"] input`,
            ) as HTMLInputElement;
            if (input && document.activeElement === input) {
              // Simply ensure the cursor stays at position 0
              input.setSelectionRange(0, 0);
            }
          }, 5);
        }
      }
    },
    [state.editingFilter.filterId, state.filters, dispatch],
  );

  const handleNavigateNextFilter = useCallback(
    (_e: CustomEvent) => {
      if (state.editingFilter.filterId) {
        const currentIndex = state.filters.findIndex(
          (f) => f.id === state.editingFilter.filterId,
        );
        if (currentIndex < state.filters.length - 1) {
          const nextFilter = state.filters[currentIndex + 1];
          // Similar approach to handleNavigatePreviousFilter
          dispatch({ type: "STOP_EDITING_FILTER" });
          dispatch({
            payload: nextFilter.id,
            type: "START_EDITING_FILTER",
          });

          // Set cursor position to the start of the next filter's value
          const value =
            nextFilter.values.join(",") +
            (nextFilter.values.length > 0 ? "," : "");
          setTimeout(() => {
            const input = document.querySelector(
              `[data-testid="filter-badge-${nextFilter.typeId}"] input`,
            ) as HTMLInputElement;
            if (input) {
              input.focus();
              // Explicitly set the value
              if (input.value !== value) {
                input.value = value;
              }
              // Set the cursor position to the start of the input - this is critical
              input.setSelectionRange(0, 0);

              // Double-check cursor position after a short delay
              setTimeout(() => {
                if (input && document.activeElement === input) {
                  input.setSelectionRange(0, 0);
                }
              }, 5);
            }
          }, 10); // Small delay to ensure DOM is updated
        } else {
          // If at the last filter, maintain cursor at the end
          const currentFilter = state.filters[currentIndex];
          setTimeout(() => {
            const input = document.querySelector(
              `[data-testid="filter-badge-${currentFilter.typeId}"] input`,
            ) as HTMLInputElement;
            if (input) {
              input.focus();
              const value =
                currentFilter.values.join(",") +
                (currentFilter.values.length > 0 ? "," : "");
              if (input.value !== value) {
                input.value = value;
              }
              // Force cursor to end
              const valueLength = input.value.length;
              input.setSelectionRange(valueLength, valueLength);
            }
          }, 10); // Small delay to ensure DOM is updated
        }
      }
    },
    [state.editingFilter.filterId, state.filters, dispatch],
  );

  // Add handler for focusing the Add filter input
  const handleFocusAddFilterInput = useCallback(() => {
    if (inputRef.current) {
      // First make sure we're not in edit mode
      dispatch({ type: "STOP_EDITING_FILTER" });
      // Then focus the Add filter input
      inputRef.current.focus();
    }
  }, [dispatch]);

  // Add event listeners for custom navigation events
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener(
        "navigatePreviousFilter",
        handleNavigatePreviousFilter as EventListener,
      );
      container.addEventListener(
        "navigateNextFilter",
        handleNavigateNextFilter as EventListener,
      );
      container.addEventListener(
        "focusAddFilterInput",
        handleFocusAddFilterInput as EventListener,
      );
    }
    return () => {
      if (container) {
        container.removeEventListener(
          "navigatePreviousFilter",
          handleNavigatePreviousFilter as EventListener,
        );
        container.removeEventListener(
          "navigateNextFilter",
          handleNavigateNextFilter as EventListener,
        );
        container.removeEventListener(
          "focusAddFilterInput",
          handleFocusAddFilterInput as EventListener,
        );
      }
    };
  }, [
    state.editingFilter.filterId,
    state.filters,
    handleNavigatePreviousFilter,
    handleNavigateNextFilter,
    handleFocusAddFilterInput,
  ]);

  return (
    <div className={clsx("w-full", className)} ref={containerRef}>
      <div className="relative">
        {/* Search input and filters container */}
        <div className="relative w-full rounded-md border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex w-full items-stretch">
            {/* Search Icon */}
            <div className="flex items-center pr-1 pl-3">
              <MagnifyingGlassIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-gray-400"
              />
            </div>
            {/* Filters and input */}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 py-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {state.filters.map((filter, index) => (
                  <div className="max-w-full flex-shrink" key={filter.id}>
                    <EditableBadge
                      color="zinc"
                      content={filter.values}
                      dataTestId={`filter-badge-${filter.typeId}`}
                      desiredCursorPos={
                        state.editingFilter.filterId === filter.id
                          ? state.editingFilter.editingCursorPos
                          : null
                      }
                      editing={{
                        onComplete: () => {
                          dispatch({ type: "STOP_EDITING_FILTER" });
                        },
                        onStart: () => {
                          dispatch({
                            payload: filter.id,
                            type: "START_EDITING_FILTER",
                          });
                        },
                      }}
                      isEditing={state.editingFilter.filterId === filter.id}
                      isFirstFilter={index === 0}
                      isLastFilter={index === state.filters.length - 1}
                      onContentChange={(values) =>
                        dispatch({
                          payload: { id: filter.id, values },
                          type: "UPDATE_FILTER_VALUES",
                        })
                      }
                      onRawValueChange={(newValue, cursorPos) =>
                        handleRawValueChange(newValue, cursorPos)
                      }
                      onRemove={() =>
                        dispatch({
                          payload: filter.id,
                          type: "REMOVE_FILTER",
                        })
                      }
                      prefix={filter.prefix}
                      rawEditValue={
                        state.editingFilter.filterId === filter.id
                          ? (state.editingFilter.editingValue ?? "")
                          : filter.values.join(",")
                      }
                      suggestions={{
                        onKeyDown: (e) => {
                          handleSuggestionKeyDown(
                            e,
                            state.editingFilter,
                            dispatch,
                            handleSelectSuggestion,
                          );
                        },
                      }}
                    />
                  </div>
                ))}
                <input
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  className="min-w-[80px] flex-1 border-none bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:border-none focus:ring-0 dark:text-white"
                  data-1p-ignore
                  data-form-type="other"
                  data-testid="job-search-input"
                  onBlur={handleFilterTypeInputBlur}
                  onChange={handleFilterTypeInputChange}
                  onFocus={() => {
                    if (!state.editingFilter.filterId) {
                      setFilterTypeDropdownOpen(true);
                      setFilterTypeSuggestions(
                        getFilteredFilterTypes(state.query),
                      );
                      setFilterTypeHighlightedIndex(0);
                    }
                  }}
                  onKeyDown={(e) => {
                    handleFilterTypeInputKeyDown(e);
                    // Handle left arrow navigation to the last filter
                    if (e.key === "ArrowLeft" && state.filters.length > 0) {
                      const input = e.target as HTMLInputElement;
                      if (
                        input.selectionStart === 0 &&
                        input.selectionEnd === 0
                      ) {
                        e.preventDefault();
                        // Find the last filter
                        const lastFilter =
                          state.filters[state.filters.length - 1];
                        // Start editing it
                        dispatch({
                          payload: lastFilter.id,
                          type: "START_EDITING_FILTER",
                        });
                        // Focus will be set by the useEffect in EditableBadge
                      }
                    }
                  }}
                  placeholder="Add filter"
                  ref={inputRef}
                  spellCheck={false}
                  type="text"
                  value={state.query}
                />
              </div>
            </div>
            {/* X Icon */}
            {(state.filters.length > 0 || state.query) && (
              <div className="flex items-center pr-3 pl-1">
                <button
                  className="shrink-0 text-gray-400 hover:text-gray-500"
                  onClick={() => dispatch({ type: "RESET_ALL" })}
                  type="button"
                >
                  <XMarkIcon aria-hidden="true" className="size-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SuggestionsDropdown for filter type selection */}
        {filterTypeDropdownOpen &&
          !state.editingFilter.filterId &&
          filterTypeSuggestions.length > 0 && (
            <SuggestionsDropdown
              editingState={{
                editingValue: state.query,
                filterId: null,
                highlightedIndex: filterTypeHighlightedIndex,
                isLoadingSuggestions: false,
                showFilterDropdown: filterTypeDropdownOpen,
                suggestions: filterTypeSuggestions.map((f) => f.label),
              }}
              handleSelectSuggestion={handleSelectFilterTypeSuggestion}
              setHighlightedIndex={setFilterTypeHighlightedIndex}
            />
          )}

        {/* Autocomplete Dropdown for filter values (unchanged) */}
        {state.editingFilter.editingValue !== null &&
          !state.editingFilter.isLoadingSuggestions &&
          state.editingFilter.suggestions.length > 0 && (
            <SuggestionsDropdown
              editingState={state.editingFilter}
              handleSelectSuggestion={handleSelectSuggestion}
              setHighlightedIndex={(index) =>
                dispatch({ payload: index, type: "SET_HIGHLIGHTED_INDEX" })
              }
            />
          )}
      </div>
    </div>
  );
}
