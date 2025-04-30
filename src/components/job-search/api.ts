import type { AutocompleteFacet } from "@services/autocomplete";

import { fetchAutocomplete } from "@services/autocomplete";

import { FilterTypeId } from "./types";

export async function fetchSuggestions(
  filterTypeId: FilterTypeId,
  query: string,
  selectedValues: string[],
): Promise<string[]> {
  if (filterTypeId === FilterTypeId.PRIORITY) {
    // Priority is a hardcoded list of values—we just need to filter out
    // already selected values.
    return ["1", "2", "3", "4"].filter(
      (priority) => !selectedValues.includes(priority),
    );
  }

  // For all other filter types, map to the correct AutocompleteFacet
  let fetchType: AutocompleteFacet | undefined;
  switch (filterTypeId) {
    case FilterTypeId.JOB_KIND:
      fetchType = "job_kind";
      break;
    case FilterTypeId.QUEUE:
      fetchType = "queue_name";
      break;
    default:
      fetchType = undefined;
  }

  if (fetchType) {
    return await fetchAutocomplete(fetchType, query, undefined, selectedValues);
  }

  return [];
}
