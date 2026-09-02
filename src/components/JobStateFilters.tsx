import Logo from "@components/Logo";
import { StatesAndCounts } from "@services/states";
import { Link } from "@tanstack/react-router";
import { jobStateFilterItems } from "@utils/jobStateFilterItems";
import React, { useMemo } from "react";

import { Badge } from "./Badge";

const compactCountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

type JobStateFiltersProps = {
  statesAndCounts?: StatesAndCounts;
};

const formatFilterItemCount = (
  item: ReturnType<typeof jobStateFilterItems>[number],
): string => {
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

const filterItemCountTitle = (
  item: ReturnType<typeof jobStateFilterItems>[number],
): string => {
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

export const JobStateFilters: (
  props: JobStateFiltersProps,
) => React.JSX.Element = ({ statesAndCounts }) => {
  const filterItems = useMemo(
    () => jobStateFilterItems(statesAndCounts),
    [statesAndCounts],
  );

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mt-3 hidden h-10 shrink-0 items-center text-slate-900 lg:flex dark:text-slate-100">
        <Logo className="h-full w-auto" />
      </div>
      <nav className="flex flex-1 flex-col">
        <ul className="flex flex-1 flex-col gap-y-4" role="list">
          <li>
            <div className="text-xs leading-6 font-semibold text-slate-500 dark:text-slate-500">
              Job State
            </div>
            <ul className="-mx-2 mt-2 space-y-1" role="list">
              {filterItems.map((item) => {
                return (
                  <li key={item.name}>
                    <Link
                      activeOptions={{
                        exact: true,
                        includeSearch: true,
                      }}
                      activeProps={{
                        className:
                          "bg-gray-50 dark:bg-gray-800 text-indigo-600 dark:text-slate-100",
                      }}
                      className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                      inactiveProps={{
                        className:
                          "text-gray-700 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800",
                      }}
                      params={{}}
                      search={{ state: item.state }}
                      to="/jobs"
                    >
                      {item.name}
                      {item.count ? (
                        <Badge
                          className="ml-auto w-9 min-w-max justify-end whitespace-nowrap"
                          color="light"
                          title={filterItemCountTitle(item)}
                        >
                          {formatFilterItemCount(item)}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
};
