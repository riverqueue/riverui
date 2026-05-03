import { XMarkIcon } from "@heroicons/react/20/solid";
import { KeyboardEvent, useState } from "react";

import { Badge, type BadgeColor } from "./Badge";

export type TagInputProps = {
  badgeColor?: BadgeColor;
  disabled?: boolean;
  id?: string;
  name?: string;
  onChange: (tags: string[]) => void;
  placeholder?: string;
  showHelpText?: boolean;
  tags: string[];
};

/**
 * A component for inputting multiple tags or keys with a chip-like UI
 */
const TagInput = ({
  badgeColor = "indigo",
  disabled = false,
  id,
  name,
  onChange,
  placeholder = "Type and press Enter to add",
  showHelpText = false,
  tags = [],
}: TagInputProps) => {
  const [inputValue, setInputValue] = useState("");

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const newTags = [...tags, trimmedTag];
      onChange(newTags);
    }
    setInputValue("");
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    onChange(newTags);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove the last tag when backspace is pressed and input is empty
      const newTags = [...tags];
      newTags.pop();
      onChange(newTags);
    }
  };

  return (
    <div className="relative">
      <div
        className={`mt-1 flex flex-wrap gap-2 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 ${
          disabled ? "cursor-not-allowed bg-gray-50 opacity-50" : "bg-white"
        } dark:border-slate-600 dark:bg-slate-700`}
        style={{ minHeight: "38px" }}
      >
        {tags.map((tag) => (
          <div className="flex items-center" key={tag}>
            <Badge className="flex items-center gap-1" color={badgeColor}>
              <span className="py-0.5">{tag}</span>
              {!disabled && (
                <button
                  aria-label={`Remove ${tag}`}
                  className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  onClick={() => removeTag(tag)}
                  type="button"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </Badge>
          </div>
        ))}
        <input
          className="flex-grow border-0 bg-transparent py-0 text-sm text-gray-900 placeholder-gray-500 focus:ring-0 focus:outline-none dark:text-white dark:placeholder-gray-400"
          disabled={disabled}
          id={id}
          name={name}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          type="text"
          value={inputValue}
        />
      </div>
      {showHelpText && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Enter multiple keys by typing each one and pressing Enter
        </p>
      )}
    </div>
  );
};

export default TagInput;
