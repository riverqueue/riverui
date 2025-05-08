import type { QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

import { ListResponse } from "./listResponse";

export type AutocompleteFacet = "job_kind" | "queue_name";

export type AutocompleteKey = [
  "autocomplete",
  AutocompleteFacet,
  string | undefined,
  string | undefined,
  string[] | undefined,
];

export const autocompleteKey = (
  facet: AutocompleteFacet,
  prefix?: string,
  after?: string,
  exclude?: string[],
): AutocompleteKey => {
  return ["autocomplete", facet, prefix, after, exclude];
};

export const getAutocomplete: QueryFunction<
  string[],
  AutocompleteKey
> = async ({ queryKey, signal }) => {
  const [, facet, prefix, after, exclude] = queryKey;
  return fetchAutocomplete(facet, prefix, after, exclude, signal);
};

// Direct API call function that doesn't use React Query
export async function fetchAutocomplete(
  facet: AutocompleteFacet,
  prefix?: string,
  after?: string,
  exclude?: string[],
  signal?: AbortSignal,
): Promise<string[]> {
  const query = new URLSearchParams({ facet });
  if (prefix) {
    query.set("prefix", prefix);
  }
  if (after) {
    query.set("after", after);
  }
  if (exclude?.length) {
    exclude.forEach((value) => query.append("exclude", value));
  }

  return API.get<ListResponse<string>>(
    { path: "/autocomplete", query },
    { signal },
  ).then((response) => response.data.map((s) => s ?? ""));
}
