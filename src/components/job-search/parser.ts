import { AVAILABLE_FILTERS, JobFilter, JobFilterTypeID } from "./types";

/**
 * Analyzes cursor position in filter text to determine what kind of autocomplete should be shown
 */
export function analyzeAutocompleteContext(
  text: string,
  cursorPos: number,
  suppressSuggestions?: boolean,
): {
  currentToken?: string;
  existingValues?: string[];
  filterTypeId?: JobFilterTypeID;
  type: "filter-type" | "filter-value" | "none";
} {
  // If suggestions are explicitly suppressed (e.g., just applied a suggestion), return none
  if (suppressSuggestions) {
    return { type: "none" };
  }

  const beforeCursor = text.substring(0, cursorPos);
  const afterCursor = text.substring(cursorPos);

  // Find the current "word" we're in by looking for spaces
  const lastSpaceIndex = beforeCursor.lastIndexOf(" ");
  const nextSpaceIndex = afterCursor.indexOf(" ");

  const currentExpression = text.substring(
    lastSpaceIndex + 1,
    nextSpaceIndex === -1 ? text.length : cursorPos + nextSpaceIndex,
  );

  const colonIndex = currentExpression.indexOf(":");

  if (colonIndex === -1) {
    // We're typing a filter type
    const currentToken = beforeCursor.substring(lastSpaceIndex + 1);
    return {
      currentToken,
      type: "filter-type",
    };
  }

  // We're after the colon, so we're typing filter values
  const filterTypeStr = currentExpression
    .substring(0, colonIndex)
    .toLowerCase();
  const filterType = AVAILABLE_FILTERS.find(
    (f) => f.label === filterTypeStr || f.prefix === `${filterTypeStr}:`,
  );

  if (!filterType) {
    return { type: "none" };
  }

  const valuesStr = currentExpression.substring(colonIndex + 1);
  const existingValues = valuesStr
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  // Find which value token the cursor is in
  const valuesBeforeCursor = beforeCursor.substring(
    beforeCursor.lastIndexOf(":") + 1,
  );
  const lastCommaIndex = valuesBeforeCursor.lastIndexOf(",");
  const currentToken = valuesBeforeCursor.substring(lastCommaIndex + 1);

  // Always show suggestions when in a filter value context, unless explicitly suppressed
  return {
    currentToken: currentToken.trim(),
    existingValues: existingValues.filter((v) => v !== currentToken.trim()),
    filterTypeId: filterType.id,
    type: "filter-value",
  };
}

/**
 * Applies a suggestion at the current cursor position
 */
export function applySuggestion(
  text: string,
  cursorPos: number,
  suggestion: string,
  suggestionType: "filter-type" | "filter-value",
): { newCursorPos: number; newText: string } {
  const beforeCursor = text.substring(0, cursorPos);
  const afterCursor = text.substring(cursorPos);

  if (suggestionType === "filter-type") {
    // Replace the current filter type token
    const lastSpaceIndex = beforeCursor.lastIndexOf(" ");
    const beforeToken = text.substring(0, lastSpaceIndex + 1);
    const newText = `${beforeToken}${suggestion}:`;
    const newCursorPos = newText.length;

    return { newCursorPos, newText };
  } else {
    // Replace the current value token
    const lastColonIndex = beforeCursor.lastIndexOf(":");
    const valuesBeforeCursor = beforeCursor.substring(lastColonIndex + 1);
    const lastCommaIndex = valuesBeforeCursor.lastIndexOf(",");

    const beforeValueToken = beforeCursor.substring(
      0,
      lastColonIndex + 1 + lastCommaIndex + 1,
    );

    // Find the end of the current token
    const nextCommaIndex = afterCursor.indexOf(",");
    const nextSpaceIndex = afterCursor.indexOf(" ");
    const tokenEnd = Math.min(
      ...[nextCommaIndex, nextSpaceIndex].filter((i) => i !== -1),
      afterCursor.length,
    );

    const afterToken = afterCursor.substring(tokenEnd);
    const newText = `${beforeValueToken}${suggestion}${afterToken}`;
    const newCursorPos = beforeValueToken.length + suggestion.length;

    return { newCursorPos, newText };
  }
}

/**
 * Consolidates filters of the same type in the text input
 * e.g., "kind:AITrainingBatch,AnalyzeTextCorpus kind:Chaos priority:2"
 * becomes "kind:AITrainingBatch,AnalyzeTextCorpus,Chaos priority:2"
 */
export function consolidateFiltersText(text: string): string {
  const filters = parseFiltersFromText(text);
  return serializeFiltersToText(filters);
}

/**
 * Converts a text string like "kind:batch,stream queue:priority" to an array of JobFilter objects
 */
export function parseFiltersFromText(text: string): JobFilter[] {
  const filters: JobFilter[] = [];
  const trimmedText = text.trim();

  if (!trimmedText) {
    return filters;
  }

  // Split by spaces to get individual filter expressions
  const filterExpressions = trimmedText.split(/\s+/);

  for (const expression of filterExpressions) {
    const colonIndex = expression.indexOf(":");
    if (colonIndex === -1) {
      continue; // Skip invalid expressions without colons
    }

    const filterTypeStr = expression.substring(0, colonIndex).toLowerCase();
    const valuesStr = expression.substring(colonIndex + 1);

    // Find the matching filter type
    const filterType = AVAILABLE_FILTERS.find(
      (f) => f.label === filterTypeStr || f.prefix === `${filterTypeStr}:`,
    );

    if (!filterType) {
      continue; // Skip unknown filter types
    }

    // Parse values (comma-separated)
    const values = valuesStr
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    // Check if we already have a filter of this type
    const existingFilter = filters.find((f) => f.typeId === filterType.id);
    if (existingFilter) {
      // Merge values with existing filter, avoiding duplicates
      const combinedValues = [...existingFilter.values, ...values];
      existingFilter.values = Array.from(new Set(combinedValues)).sort();
    } else {
      // Create new filter
      filters.push({
        id: Math.random().toString(36).substr(2, 9),
        prefix: filterType.prefix,
        typeId: filterType.id,
        values: Array.from(new Set(values)).sort(),
      });
    }
  }

  return filters;
}

/**
 * Converts an array of JobFilter objects to a text string like "kind:batch,stream queue:priority"
 */
export function serializeFiltersToText(filters: JobFilter[]): string {
  return filters
    .filter((filter) => filter.values.length > 0)
    .map((filter) => {
      const typeLabel = filter.prefix.replace(":", "");
      const valuesStr = filter.values.join(",");
      return `${typeLabel}:${valuesStr}`;
    })
    .join(" ");
}
