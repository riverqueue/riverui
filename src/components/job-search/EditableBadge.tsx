import { XMarkIcon } from "@heroicons/react/16/solid";
import clsx from "clsx";
import React, { useEffect, useRef } from "react";

import { Badge, BadgeColor } from "../Badge";

export interface EditableBadgeProps {
  className?: string;
  color?: BadgeColor;
  content: string[];
  dataTestId?: string;
  desiredCursorPos?: null | number;
  editing?: {
    onComplete?: () => void;
    onStart?: () => void;
  };
  isEditing?: boolean;
  onContentChange: (values: string[]) => void;
  onRawValueChange?: (newValue: string, cursorPos: null | number) => void;
  onRemove: () => void;
  prefix: string;
  rawEditValue?: string;
  suggestions?: {
    onKeyDown?: (e: React.KeyboardEvent) => void;
  };
}

export function EditableBadge({
  className,
  color = "zinc",
  content = [],
  dataTestId,
  desiredCursorPos = null,
  editing = {},
  isEditing = false,
  onRawValueChange,
  onRemove,
  prefix,
  rawEditValue = "",
  suggestions = {},
}: EditableBadgeProps) {
  const { onComplete: onEditComplete, onStart: onEditStart } = editing;
  const { onKeyDown: onSuggestionKeyDown } = suggestions;

  const initialContentString = content.join(",");
  const displayValue = isEditing ? rawEditValue : initialContentString;

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      const input = inputRef.current;
      // If editing starts, focus the input and move cursor to end
      if (input && document.activeElement !== input) {
        input.focus();
        const len = input.value.length ?? 0;
        input.setSelectionRange(len, len);
      }
    }
  }, [isEditing]);

  // Effect to set cursor position programmatically when desired state changes
  useEffect(() => {
    if (isEditing && desiredCursorPos !== null) {
      const input = inputRef.current;
      if (input) {
        // Use rAF to ensure this runs after potential value updates and rendering
        requestAnimationFrame(() => {
          // Only set if the current position doesn't already match the desired one
          if (
            input.selectionStart !== desiredCursorPos ||
            input.selectionEnd !== desiredCursorPos
          ) {
            input.setSelectionRange(desiredCursorPos, desiredCursorPos);
          }
        });
      }
    }
    // Run when desired position changes while editing
  }, [isEditing, desiredCursorPos]);

  // Effect to blur input when edit mode ends
  useEffect(() => {
    if (!isEditing && inputRef.current) {
      inputRef.current.blur();
    }
  }, [isEditing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) return;
    onRawValueChange?.(e.target.value, e.target.selectionStart);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isEditing) return;

    // Let parent handle suggestion nav first, check if it handled the event
    onSuggestionKeyDown?.(e);
    if (e.defaultPrevented) {
      return; // Parent handled it (e.g., selected suggestion)
    }

    // Handle local completion keys only if parent didn't handle event
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      onEditComplete?.();
    }
  };

  const handleBlur = () => {
    // If blur happens while editing, complete the edit immediately
    // Note: Suggestion clicks use onMouseDown + preventDefault to avoid blur
    if (isEditing) {
      onEditComplete?.();
    }
  };

  const handleBadgeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditing && e.target === e.currentTarget) {
      onEditStart?.();
    }
  };

  const handleInputFocus = () => {
    if (!isEditing) {
      onEditStart?.();
    }
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (!isEditing) {
      onEditStart?.();
    }
  };

  const handleRemoveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <Badge
      className={clsx(
        "group relative flex items-center gap-1 !py-0 pr-1",
        "max-w-full",
        !isEditing && "cursor-pointer",
        isEditing &&
          "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800",
        className,
      )}
      color={color}
      data-testid={dataTestId}
      onClick={handleBadgeClick}
      onMouseDown={(e) => {
        // Prevent focus shift away *only* if clicking badge background while editing
        // Allow default mousedown behavior (like cursor positioning) on the input itself
        if (isEditing && e.target !== inputRef.current) {
          e.preventDefault();
        }
      }}
    >
      <span className="shrink-0 font-medium">{prefix}</span>

      <input
        aria-label={`Filter values for ${prefix}`}
        className={clsx(
          "border-none bg-transparent p-0",
          "focus:ring-0 focus:outline-none",
          "text-sm/5 font-medium sm:text-xs/5",
          "field-sizing-content",
          "max-w-full min-w-[2ch]",
          !isEditing && "cursor-pointer truncate overflow-ellipsis",
        )}
        data-1p-ignore
        data-form-type="other"
        onBlur={handleBlur}
        onChange={handleInputChange}
        onClick={handleInputClick}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        title={!isEditing ? displayValue : undefined}
        type="text"
        value={displayValue}
      />

      <button
        aria-label={`Remove filter ${prefix}`}
        className="shrink-0 cursor-pointer rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        onClick={handleRemoveClick}
        tabIndex={isEditing ? -1 : 0}
        type="button"
      >
        <XMarkIcon className="size-3.5" />
      </button>
    </Badge>
  );
}
