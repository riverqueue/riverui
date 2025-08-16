import { useCallback, useEffect, useRef, useState } from "react";

import {
  analyzeAutocompleteContext,
  applySuggestion,
  consolidateFiltersText,
  parseFiltersFromText,
  serializeFiltersToText,
} from "./parser";
import { AVAILABLE_FILTERS, JobFilter, JobFilterTypeID } from "./types";

interface SuggestionsState {
  highlightedIndex: number;
  isLoading: boolean;
  suggestions: string[];
  type: "filter-type" | "filter-value" | "none";
}

interface UseFilterInputProps {
  fetchSuggestions: (
    filterTypeId: JobFilterTypeID,
    query: string,
    selectedValues: string[],
  ) => Promise<string[]>;
  initialFilters: JobFilter[];
  onFiltersChange?: (filters: JobFilter[]) => void;
}

interface UseSuggestionsProps {
  fetchSuggestions: (
    filterTypeId: JobFilterTypeID,
    query: string,
    selectedValues: string[],
  ) => Promise<string[]>;
  suppressSuggestions: boolean;
}

export function useFilterInput({
  fetchSuggestions,
  initialFilters,
  onFiltersChange,
}: UseFilterInputProps) {
  const initialText = serializeFiltersToText(initialFilters);
  const [inputValue, setInputValue] = useState(initialText);
  const [cursorPosition, setCursorPosition] = useState(inputValue.length);
  const [suppressSuggestions, setSuppressSuggestions] = useState(false);
  const [lastSuggestionApplication, setLastSuggestionApplication] = useState<{
    cursorPos: number;
    text: string;
  } | null>(null);

  const debounceTimeoutRef = useRef<number | undefined>(undefined);
  const currentFilters = parseFiltersFromText(inputValue);

  const {
    clearSuggestions,
    setHighlightedIndex,
    suggestionsState,
    updateSuggestions,
  } = useSuggestions({ fetchSuggestions, suppressSuggestions });

  // Debounced filter change notification
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      onFiltersChange?.(currentFilters);
    }, 200);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [currentFilters, onFiltersChange]);

  const handleInputChange = useCallback(
    (newValue: string, newCursor: number) => {
      // Reset suppression if moved away from last application
      if (
        lastSuggestionApplication &&
        (newValue !== lastSuggestionApplication.text ||
          newCursor !== lastSuggestionApplication.cursorPos)
      ) {
        setSuppressSuggestions(false);
        setLastSuggestionApplication(null);
      }

      setInputValue(newValue);
      setCursorPosition(newCursor);
      updateSuggestions(newValue, newCursor);
    },
    [lastSuggestionApplication, updateSuggestions],
  );

  // Handle colon shortcut separately to avoid circular dependency
  const handleColonShortcut = useCallback(
    (newValue: string, inputLength: number) => {
      if (newValue.endsWith(":") && inputLength < newValue.length) {
        const beforeColon = newValue.slice(0, -1).trim();
        const words = beforeColon.split(/\s+/);
        const lastWord = words[words.length - 1];
        const filterType = AVAILABLE_FILTERS.find(
          (f) => f.label.toLowerCase() === lastWord.toLowerCase(),
        );
        return filterType?.label;
      }
      return null;
    },
    [],
  );

  const handleSelectSuggestion = useCallback(
    (suggestion: string) => {
      const context = analyzeAutocompleteContext(inputValue, cursorPosition);
      const result = applySuggestion(
        inputValue,
        cursorPosition,
        suggestion,
        context.type as "filter-type" | "filter-value",
      );

      setInputValue(result.newText);
      setCursorPosition(result.newCursorPos);
      clearSuggestions();

      const shouldSuppress = context.type === "filter-value";
      setSuppressSuggestions(shouldSuppress);
      if (shouldSuppress) {
        setLastSuggestionApplication({
          cursorPos: result.newCursorPos,
          text: result.newText,
        });
      }

      return {
        newCursorPos: result.newCursorPos,
        newText: result.newText,
        shouldShowValueSuggestions: context.type === "filter-type",
      };
    },
    [inputValue, cursorPosition, clearSuggestions],
  );

  const handleClearAll = useCallback(() => {
    setInputValue("");
    setCursorPosition(0);
    clearSuggestions();
    setSuppressSuggestions(false);
    setLastSuggestionApplication(null);
  }, [clearSuggestions]);

  const handleBlur = useCallback(() => {
    clearSuggestions();

    // Process input validation and consolidation
    setTimeout(() => {
      const trailingWhitespaceMatch = inputValue.match(/\s+$/);
      const trailingWhitespace = trailingWhitespaceMatch
        ? trailingWhitespaceMatch[0]
        : "";
      const trimmedValue = inputValue.trim();

      // Clear invalid filter type text
      if (trimmedValue && !trimmedValue.includes(":")) {
        const isValidFilterType = AVAILABLE_FILTERS.some((f) =>
          f.label.toLowerCase().includes(trimmedValue.toLowerCase()),
        );
        if (!isValidFilterType) {
          setInputValue("");
          setCursorPosition(0);
          return;
        }
      }

      // Consolidate filters
      if (trimmedValue) {
        const consolidated = consolidateFiltersText(trimmedValue);
        const newText = consolidated + trailingWhitespace;
        if (newText !== inputValue) {
          setInputValue(newText);
          setCursorPosition(newText.length);
        }
      }
    }, 150);
  }, [inputValue, clearSuggestions]);

  return {
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
  };
}

export function useSuggestions({
  fetchSuggestions,
  suppressSuggestions,
}: UseSuggestionsProps) {
  const [suggestionsState, setSuggestionsState] = useState<SuggestionsState>({
    highlightedIndex: -1,
    isLoading: false,
    suggestions: [],
    type: "none",
  });

  const latestSuggestionRequestRef = useRef(0);

  const updateSuggestions = useCallback(
    async (text: string, cursor: number) => {
      const requestId = ++latestSuggestionRequestRef.current;
      const context = analyzeAutocompleteContext(
        text,
        cursor,
        suppressSuggestions,
      );

      if (context.type === "none") {
        setSuggestionsState((prev) => ({
          ...prev,
          isLoading: false,
          suggestions: [],
          type: "none",
        }));
        return;
      }

      // If we're suggesting filter types, we can compute synchronously and avoid the loading state
      if (context.type === "filter-type") {
        const query = context.currentToken || "";
        const suggestions = AVAILABLE_FILTERS.filter(
          (f) =>
            f.label.toLowerCase().includes(query.toLowerCase()) ||
            f.match.toLowerCase().startsWith(query.toLowerCase()),
        ).map((f) => f.label);

        setSuggestionsState((prev) => ({
          ...prev,
          highlightedIndex: -1,
          isLoading: false,
          suggestions,
          type: "filter-type",
        }));
        return;
      }

      // For filter value suggestions we need to fetch asynchronously.
      // Only show the loading indicator if we don't already have suggestions.
      setSuggestionsState((prev) => ({
        ...prev,
        highlightedIndex: -1,
        isLoading: prev.suggestions.length === 0,
        type: context.type,
      }));

      try {
        let suggestions: string[] = [];

        if (context.type === "filter-value" && context.filterTypeId) {
          suggestions = await fetchSuggestions(
            context.filterTypeId,
            context.currentToken || "",
            context.existingValues || [],
          );
        }

        if (requestId !== latestSuggestionRequestRef.current) {
          return;
        }

        setSuggestionsState((prev) => ({
          ...prev,
          highlightedIndex: -1,
          isLoading: false,
          suggestions,
        }));
      } catch (_error) {
        if (requestId !== latestSuggestionRequestRef.current) {
          return;
        }
        setSuggestionsState((prev) => ({
          ...prev,
          highlightedIndex: -1,
          isLoading: false,
          suggestions: [],
        }));
      }
    },
    [fetchSuggestions, suppressSuggestions],
  );

  const clearSuggestions = useCallback(() => {
    setSuggestionsState((prev) => ({
      ...prev,
      highlightedIndex: -1,
      suggestions: [],
      type: "none",
    }));
  }, []);

  const setHighlightedIndex = useCallback((index: number) => {
    setSuggestionsState((prev) => ({ ...prev, highlightedIndex: index }));
  }, []);

  return {
    clearSuggestions,
    setHighlightedIndex,
    suggestionsState,
    updateSuggestions,
  };
}
