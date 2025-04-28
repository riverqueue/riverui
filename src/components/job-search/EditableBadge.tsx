import { XMarkIcon } from "@heroicons/react/16/solid";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

import { Badge, BadgeColor } from "../Badge";

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
  // Ensure content is always an array
  const initialContent = Array.isArray(content) ? content : [];
  const [editValue, setEditValue] = useState(initialContent.join(","));
  const [lastSelectedSuggestion, setLastSelectedSuggestion] = useState<
    string | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update editValue when content prop changes
  useEffect(() => {
    const newContent = Array.isArray(content) ? content : [];
    setEditValue(newContent.join(","));
  }, [content]);

  // Update editValue when a suggestion is selected
  useEffect(() => {
    if (
      selectedSuggestion &&
      isEditing &&
      selectedSuggestion !== lastSelectedSuggestion
    ) {
      setLastSelectedSuggestion(selectedSuggestion);
      // Get the current values and editing state
      let values = editValue.split(",").map((v) => v.trim());
      const editingState = getCurrentEditingValue(editValue, editValue.length);
      // Update the values array with the selected suggestion
      if (
        editingState.editingIndex >= 0 &&
        editingState.editingIndex < values.length
      ) {
        values[editingState.editingIndex] = selectedSuggestion;
      } else {
        // Only push if not empty (prevents leading comma)
        if (selectedSuggestion) {
          values.push(selectedSuggestion);
        }
      }
      // Remove empty values and update editValue
      values = values.filter(Boolean);
      setEditValue(values.join(","));
      // Do NOT sort/dedupe here—let user see their order until they exit edit mode
      onContentChange(values);
      // Notify that the suggestion has been applied
      onSuggestionApplied?.();
    }
  }, [
    selectedSuggestion,
    isEditing,
    onContentChange,
    lastSelectedSuggestion,
    onSuggestionApplied,
  ]);

  // Focus the input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      // Ensure trailing comma for easy addition of a new value
      const contentArr = Array.isArray(content) ? content : [];
      const desired = contentArr.join(",") + (contentArr.length > 0 ? "," : "");
      if (editValue === contentArr.join(",")) {
        // Only update if we haven't started editing yet (to avoid clobbering user input)
        setEditValue(desired);
      }
      if (inputRef.current) {
        inputRef.current.focus();
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) {
      const cursorPos = editValue.length;
      const editingState = getCurrentEditingValue(editValue, cursorPos);
      if (editingState.editingIndex !== -1) {
        onEditingValueChange?.(
          editingState.editingValue,
          editingState.editingIndex,
        );
      }
    }
  }, [isEditing]);

  const getCurrentEditingValue = (
    value: string,
    cursorPosition: number,
  ): { editingIndex: number; editingValue: string } => {
    const values = value.split(",").map((v) => v.trim());

    // Special case: cursor is at end and value ends with a comma → new empty token
    if (value.endsWith(",") && cursorPosition === value.length) {
      return { editingIndex: values.length, editingValue: "" };
    }

    let charCount = 0;
    let editingIndex = -1;
    let editingValue = "";
    for (let i = 0; i < values.length; i++) {
      const valueLength = values[i].length;
      const separatorLength = i < values.length - 1 ? 1 : 0; // comma length
      if (
        charCount <= cursorPosition &&
        cursorPosition <= charCount + valueLength + separatorLength
      ) {
        editingIndex = i;
        editingValue = values[i];
        break;
      }
      charCount += valueLength + separatorLength;
    }

    // If cursor is beyond all characters but we didn't match above, we're editing a new token
    if (editingIndex === -1) {
      editingIndex = values.length; // next token index
      editingValue = "";
    }
    return { editingIndex, editingValue };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) return;
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;
    setEditValue(newValue);
    const editingState = getCurrentEditingValue(newValue, cursorPosition);
    if (editingState.editingIndex !== -1) {
      onEditingValueChange?.(
        editingState.editingValue,
        editingState.editingIndex,
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isEditing) return;

    // Let parent component handle suggestion navigation/selection first
    onSuggestionKeyDown?.(e);
    if (e.defaultPrevented) {
      return; // Parent handled the key event (e.g., selected a suggestion)
    }

    if (e.key === "Enter") {
      const values = editValue
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const uniqueSorted = Array.from(new Set(values)).sort();
      onContentChange(uniqueSorted);
      onEditComplete?.();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setEditValue(initialContent.join(","));
      onEditComplete?.();
      inputRef.current?.blur();
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      const values = editValue
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const uniqueSorted = Array.from(new Set(values)).sort();
      onContentChange(uniqueSorted);
      onEditComplete?.();
    }
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
      <input
        className={clsx(
          "border-none bg-transparent p-0",
          "focus:ring-0 focus:outline-none",
          "text-sm/5 font-medium sm:text-xs/5",
          "field-sizing-content",
          !isEditing && "cursor-pointer",
        )}
        onBlur={handleBlur}
        onChange={handleInputChange}
        onClick={(e) => {
          e.stopPropagation();
          if (!isEditing) {
            onEditStart?.();
          }
        }}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        type="text"
        value={editValue}
        style={{ minWidth: "2ch" }}
      />
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
