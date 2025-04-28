import {
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
} from "@headlessui/react";
import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/16/solid";
import { CheckIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";

import { Badge, BadgeColor } from "@/components/Badge";

export interface EditableBadgeProps {
  className?: string;
  color?: BadgeColor;
  content: string[];
  isEditing?: boolean;
  onContentChange: (values: string[]) => void;
  onEditComplete?: () => void;
  onEditingValueChange?: (value: string, index: number) => void;
  onEditStart?: () => void;
  onRemove: () => void;
  prefix: string;
  selectedSuggestion?: string | null;
  onSuggestionApplied?: () => void;
  onSuggestionKeyDown?: (e: React.KeyboardEvent) => void;
  fetchSuggestions: (query: string) => Promise<string[]>;
}

export function EditableBadge({
  className,
  color = "zinc",
  content = [],
  isEditing = false,
  onContentChange,
  onEditComplete,
  onEditingValueChange,
  onEditStart,
  onRemove,
  prefix,
  selectedSuggestion = null,
  onSuggestionApplied,
  onSuggestionKeyDown,
  fetchSuggestions,
}: EditableBadgeProps) {
  const [editValue, setEditValue] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Initialize editValue when entering edit mode
  useEffect(() => {
    if (isEditing) {
      const contentArray = Array.isArray(content) ? content : [];
      setEditValue(contentArray.join(", "));
    }
  }, [isEditing, content]);

  // Fetch suggestions based on the current value after the last comma
  useEffect(() => {
    const currentValue = editValue.split(",").pop()?.trim() || "";
    if (currentValue && isEditing) {
      fetchSuggestions(currentValue).then(setSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [editValue, fetchSuggestions, isEditing]);

  // Handle suggestion selection
  const handleSelect = (selected: string) => {
    const parts = editValue.split(",").map((part) => part.trim());
    parts.pop(); // Remove the current incomplete value
    parts.push(selected, ""); // Add selected value and a space for next input
    const newValue = parts.filter(Boolean).join(", ") + ", ";
    setEditValue(newValue);
    onSuggestionApplied?.();
  };

  // Handle input change and prevent multiple consecutive commas
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Replace multiple commas with a single comma and ensure proper spacing
    const cleanedValue =
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", ") + (value.endsWith(",") ? ", " : "");
    setEditValue(cleanedValue);
  };

  // Finalize editing and pass values to parent
  const handleBlur = () => {
    const values = editValue
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    onContentChange(values);
    onEditComplete?.();
  };

  return (
    <Badge
      className={clsx(
        "group relative flex items-center gap-1 pr-1",
        isEditing && "ring-2 ring-blue-500 ring-offset-2",
        className,
      )}
      color={color}
    >
      <span className="shrink-0 font-medium">{prefix}</span>
      <Combobox
        value={null}
        onChange={(value: string | null) => value && handleSelect(value)}
      >
        <ComboboxInput
          className={clsx(
            "border-none bg-transparent p-0",
            "focus:ring-0 focus:outline-none",
            "text-sm/5 font-medium sm:text-xs/5",
            "field-sizing-content",
            !isEditing && "cursor-pointer",
          )}
          value={editValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditing) onEditStart?.();
          }}
          onKeyDown={onSuggestionKeyDown}
          placeholder="Type and select values..."
        />
        {suggestions.length > 0 && (
          <ComboboxOptions className="absolute left-0 z-10 mt-1 max-h-60 w-64 overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-hidden dark:bg-gray-800 dark:ring-white/10">
            {suggestions.map((suggestion) => (
              <ComboboxOption
                key={suggestion}
                value={suggestion}
                className="group relative cursor-default py-2 pr-9 pl-3 text-gray-900 select-none data-focus:bg-blue-600 data-focus:text-white dark:text-gray-100"
              >
                {({ selected, active }) => (
                  <>
                    <span
                      className={clsx(
                        "block truncate",
                        selected && "font-semibold",
                      )}
                    >
                      {suggestion}
                    </span>
                    {selected && (
                      <span
                        className={clsx(
                          "absolute inset-y-0 right-0 flex items-center pr-4",
                          active
                            ? "text-white"
                            : "text-blue-600 dark:text-blue-400",
                        )}
                      >
                        <CheckIcon className="size-5" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        )}
      </Combobox>
      <button
        aria-label="Remove filter"
        className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        type="button"
      >
        <XMarkIcon className="size-3.5" />
      </button>
    </Badge>
  );
}
