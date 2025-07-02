import clsx from "clsx";

interface SuggestionsDropdownProps {
  highlightedIndex: number;
  isLoading: boolean;
  onHighlightChange: (index: number) => void;
  onSelectSuggestion: (suggestion: string) => void;
  suggestions: string[];
}

export function SuggestionsDropdown({
  highlightedIndex,
  isLoading,
  onHighlightChange,
  onSelectSuggestion,
  suggestions,
}: SuggestionsDropdownProps) {
  if (!isLoading && suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
      data-testid="suggestions-dropdown"
    >
      <div className="p-2">
        <div className="space-y-1" data-testid="suggestions-list">
          {isLoading && (
            <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              Loading suggestions...
            </div>
          )}
          {suggestions.length === 0 && !isLoading && (
            <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              No suggestions found
            </div>
          )}
          <div className="space-y-1">
            {suggestions.map((suggestion: string, index: number) => (
              <button
                className={clsx(
                  "flex w-full items-center rounded-md px-2 py-1 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700",
                  highlightedIndex >= 0 &&
                    index === highlightedIndex &&
                    "bg-gray-100 dark:bg-gray-700",
                )}
                data-testid={`suggestion-${suggestion}`}
                key={suggestion}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelectSuggestion(suggestion);
                }}
                onMouseEnter={() => {
                  onHighlightChange(index);
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
}
