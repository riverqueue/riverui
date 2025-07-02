import { KeyboardEvent, useCallback } from "react";

import { analyzeAutocompleteContext } from "../parser";

interface UseKeyboardNavigationProps {
  cursorPosition: number;
  highlightedIndex: number;
  inputValue: string;
  onClearAll: () => void;
  onClearSuggestions: () => void;
  onHighlightChange: (index: number) => void;
  onSelectSuggestion: (suggestion: string) => void;
  suggestions: string[];
  suggestionsCount: number;
}

export function useKeyboardNavigation({
  cursorPosition,
  highlightedIndex,
  inputValue,
  onClearAll,
  onClearSuggestions,
  onHighlightChange,
  onSelectSuggestion,
  suggestions,
  suggestionsCount,
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (suggestionsCount > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const newIndex =
            highlightedIndex === -1
              ? 0
              : (highlightedIndex + 1) % suggestionsCount;
          onHighlightChange(newIndex);
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          const newIndex =
            highlightedIndex === -1
              ? suggestionsCount - 1
              : (highlightedIndex - 1 + suggestionsCount) % suggestionsCount;
          onHighlightChange(newIndex);
          return;
        }

        if (e.key === "Enter") {
          if (highlightedIndex >= 0 && highlightedIndex < suggestionsCount) {
            e.preventDefault();
            onSelectSuggestion(suggestions[highlightedIndex]);
            return;
          }

          // Auto-select first suggestion if there's text being typed
          const context = analyzeAutocompleteContext(
            inputValue,
            cursorPosition,
          );
          if (context.currentToken && context.currentToken.trim().length > 0) {
            e.preventDefault();
            onSelectSuggestion(suggestions[0]);
            return;
          }
        }

        if (e.key === "Escape") {
          e.preventDefault();
          onClearSuggestions();
          return;
        }
      }

      // Handle Escape to clear input when no suggestions are shown
      if (e.key === "Escape") {
        e.preventDefault();
        onClearAll();
      }
    },
    [
      inputValue,
      cursorPosition,
      suggestionsCount,
      highlightedIndex,
      onHighlightChange,
      onSelectSuggestion,
      onClearSuggestions,
      onClearAll,
      suggestions,
    ],
  );

  return { handleKeyDown };
}
