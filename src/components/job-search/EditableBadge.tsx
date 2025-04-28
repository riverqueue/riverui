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
  onSuggestionApplied?: () => void;
  onSuggestionKeyDown?: (e: React.KeyboardEvent) => void;
  prefix: string;
  selectedSuggestion?: null | string;
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
  onSuggestionApplied,
  onSuggestionKeyDown,
  prefix,
  selectedSuggestion = null,
}: EditableBadgeProps) {
  const initialContent = Array.isArray(content) ? content : [];
  const [editValue, setEditValue] = useState(initialContent.join(","));
  const [lastSelectedSuggestion, setLastSelectedSuggestion] = useState<
    null | string
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(Array.isArray(content) ? content.join(",") : "");
  }, [content]);

  useEffect(() => {
    if (
      selectedSuggestion &&
      isEditing &&
      selectedSuggestion !== lastSelectedSuggestion
    ) {
      setLastSelectedSuggestion(selectedSuggestion);

      const values = editValue.split(",").map((v) => v.trim());
      const { editingIndex } = getCurrentEditingValue(
        editValue,
        editValue.length,
      );

      if (editingIndex < values.length) {
        values[editingIndex] = selectedSuggestion;
      } else {
        values.push(selectedSuggestion);
      }

      const cleaned = values.filter(Boolean);
      setEditValue(cleaned.join(","));
      onContentChange(cleaned);
      onSuggestionApplied?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSuggestion, isEditing]);

  useEffect(() => {
    if (!isEditing) return;

    const contentArr = Array.isArray(content) ? content : [];
    const desired = contentArr.join(",") + (contentArr.length > 0 ? "," : "");

    if (editValue === contentArr.join(",")) {
      setEditValue(desired);
      onEditingValueChange?.("", contentArr.length);
    }

    if (inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const getCurrentEditingValue = (
    value: string,
    cursor: number,
  ): { editingIndex: number; editingValue: string } => {
    const parts = value.split(",").map((v) => v.trim());

    if (value.endsWith(",") && cursor === value.length) {
      return { editingIndex: parts.length, editingValue: "" };
    }

    let acc = 0;
    for (let i = 0; i < parts.length; i++) {
      const len = parts[i].length + (i < parts.length - 1 ? 1 : 0);
      if (cursor <= acc + len) {
        return { editingIndex: i, editingValue: parts[i] };
      }
      acc += len;
    }
    return { editingIndex: parts.length, editingValue: "" };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) return;

    const newVal = e.target.value;
    const cursor = e.target.selectionStart ?? 0;
    setEditValue(newVal);

    const { editingIndex, editingValue } = getCurrentEditingValue(
      newVal,
      cursor,
    );
    onEditingValueChange?.(editingValue, editingIndex);
  };

  const commitAndFinish = () => {
    const uniq = Array.from(
      new Set(
        editValue
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    );
    const sortedValues = [...uniq].sort();
    onContentChange(sortedValues);
    onEditComplete?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isEditing) return;

    onSuggestionKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (e.key === "Enter") {
      e.preventDefault();
      commitAndFinish();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setEditValue(initialContent.join(","));
      onEditComplete?.();
      inputRef.current?.blur();
    }
  };

  const handleBlur = () => {
    if (isEditing) commitAndFinish();
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
          if (!isEditing) onEditStart?.();
        }}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        style={{ minWidth: "2ch" }}
        type="text"
        value={editValue}
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
