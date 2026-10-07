import { StateCount } from "@services/states";

const compactCountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

export const formatStateCount = (item: StateCount): string => {
  switch (item.accuracy) {
    case "estimated":
      // The approximation marker prevents a planner estimate from looking
      // indistinguishable from an exact snapshot.
      return `≈${compactCountFormatter.format(item.count)}`;
    case "exact":
      // Small exact values are easiest to scan without abbreviation.
      return item.count.toString();
    case "exact_cached":
      // Compact notation retains the useful order of magnitude in a narrow
      // sidebar; the tooltip below keeps the full exact snapshot available.
      return compactCountFormatter.format(item.count);
    case "lower_bound":
      // A plus is the strongest claim supported by the bounded index scan.
      return `${compactCountFormatter.format(item.count)}+`;
  }
};

export const stateCountTitle = (item: StateCount): string => {
  const fullCount = item.count.toLocaleString("en-US");
  const observedAt = item.observedAt?.toLocaleString();

  switch (item.accuracy) {
    case "estimated":
      return `Approximately ${fullCount} jobs (database statistics${observedAt ? ` from ${observedAt}` : ""})`;
    case "exact":
      return `${fullCount} jobs (exact)`;
    case "exact_cached":
      return `${fullCount} jobs (exact snapshot${observedAt ? ` from ${observedAt}` : ""})`;
    case "lower_bound":
      return `At least ${fullCount} jobs; an exact snapshot or useful database estimate is not available yet`;
  }
};
