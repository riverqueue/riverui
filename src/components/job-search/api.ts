import { FilterTypeId } from "./types";

export async function fetchSuggestions(
  filterTypeId: FilterTypeId,
  query: string,
  selectedValues: string[],
): Promise<string[]> {
  console.log(
    `Fetching suggestions for filter type: ${filterTypeId}, query: ${query}, excluding: ${selectedValues.join(", ")}`,
  );
  switch (filterTypeId) {
    case FilterTypeId.JOB_KIND:
      // Placeholder for real API call - to be implemented by the user.
      return ["batch", "stream", "scheduled", "one-time", "recurring"]
        .filter((possibleResult) => !selectedValues.includes(possibleResult))
        .filter((possibleResult) =>
          possibleResult.toLowerCase().includes(query.toLowerCase()),
        );
    case FilterTypeId.PRIORITY:
      // Priority is a hardcoded list of values—we just need to filter out
      // already selected values.
      return ["1", "2", "3", "4"].filter(
        (priority) => !selectedValues.includes(priority),
      );
    case FilterTypeId.QUEUE:
      return ["default", "high-priority", "low-priority", "batch", "realtime"];
    default:
      return [];
  }
}
