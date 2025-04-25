import { XMarkIcon } from "@heroicons/react/16/solid";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

import { Badge, BadgeColor } from "./Badge";

export interface EditableBadgeProps {
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * The color of the badge
   */
  color?: BadgeColor;
  /**
   * The editable content of the badge
   */
  content: string[];
  /**
   * Whether the badge is currently being edited
   */
  isEditing?: boolean;
  /**
   * Callback when the content is edited
   */
  onContentChange: (values: EditableValue) => void;
  /**
   * Callback when editing is complete
   */
  onEditComplete?: () => void;
  /**
   * Optional callback to handle showing/hiding autocomplete
   * Returns the partial value being edited and its index
   */
  onEditingValueChange?: (value: string, index: number) => void;
  /**
   * Callback when the badge is clicked to enter edit mode
   */
  onEditStart?: () => void;
  /**
   * Callback when the badge is removed
   */
  onRemove: () => void;
  /**
   * The non-editable prefix text (e.g., "kind:")
   */
  prefix: string;
}

export interface EditableValue {
  cursorPosition: number;
  editingIndex: number; // -1 if not editing any specific value
  editingValue: string; // The current value being edited
  values: string[];
}

export function EditableBadge({
  className,
  color = "zinc",
  content = [], // Provide default empty array
  isEditing = false,
  onContentChange,
  onEditComplete,
  onEditingValueChange,
  onEditStart,
  onRemove,
  prefix,
}: EditableBadgeProps) {
  // Ensure content is always an array
  const initialContent = Array.isArray(content) ? content : [];
  const [editValue, setEditValue] = useState(initialContent.join(", "));
  const inputRef = useRef<HTMLInputElement>(null);

  // Update editValue when content prop changes
  useEffect(() => {
    const newContent = Array.isArray(content) ? content : [];
    setEditValue(newContent.join(", "));
  }, [content]);

  // Focus the input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const getCurrentEditingValue = (
    value: string,
    cursorPosition: number,
  ): EditableValue => {
    // Split by comma but preserve empty values to maintain proper indexing
    const values = value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== undefined); // Only filter undefined, keep empty strings

    // Find which value is being edited based on cursor position
    let charCount = 0;
    let editingIndex = -1;
    let editingValue = "";

    for (let i = 0; i < values.length; i++) {
      const valueLength = values[i].length;
      const separatorLength = i < values.length - 1 ? 2 : 0; // ", " length

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

    // If cursor is at the end and we haven't found an editing index,
    // we're editing a new value
    if (editingIndex === -1 && cursorPosition >= value.length) {
      editingIndex = Math.max(0, values.length - 1);
      editingValue = values[values.length - 1] || "";
    }

    return {
      cursorPosition,
      editingIndex,
      editingValue,
      values: values.filter(Boolean), // Only filter empty strings when returning final values
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) return;

    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    // Always update the display value with exactly what the user typed
    setEditValue(newValue);

    const editingState = getCurrentEditingValue(newValue, cursorPosition);
    onContentChange(editingState);
    if (editingState.editingIndex !== -1) {
      onEditingValueChange?.(
        editingState.editingValue,
        editingState.editingIndex,
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isEditing) return;

    if (e.key === "Enter") {
      const finalState = getCurrentEditingValue(editValue, editValue.length);
      onContentChange(finalState);
      onEditComplete?.();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setEditValue(initialContent.join(", "));
      onEditComplete?.();
      inputRef.current?.blur();
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      const finalState = getCurrentEditingValue(editValue, editValue.length);
      onContentChange(finalState);
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
          "text-sm/5 font-medium sm:text-xs/5", // Match Badge text styling
          "field-sizing-content", // Allow input to shrink and grow naturally with content
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
      />
      <button
        aria-label="Remove filter"
        className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
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
