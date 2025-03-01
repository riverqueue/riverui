import { Link } from "@tanstack/react-router";
import React, { useMemo } from "react";

import Logo from "@components/Logo";
import { StatesAndCounts } from "@services/states";
import { jobStateFilterItems } from "@utils/jobStateFilterItems";
import { Badge } from "./Badge";

type JobFiltersProps = {
  statesAndCounts?: StatesAndCounts;
};

export const JobFilters: (props: JobFiltersProps) => React.JSX.Element = ({
  statesAndCounts,
}) => {
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
        <ul role="list" className="flex flex-1 flex-col gap-y-4">
          <li>
            <div className="text-xs leading-6 font-semibold text-slate-500 dark:text-slate-500">
              Job State
            </div>
            <ul role="list" className="-mx-2 mt-2 space-y-1">
              {filterItems.map((item) => {
                return (
                  <li key={item.name}>
                    <Link
                      to="/jobs"
                      className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                      activeProps={{
                        className:
                          "bg-gray-50 dark:bg-gray-800 text-indigo-600 dark:text-slate-100",
                      }}
                      inactiveProps={{
                        className:
                          "text-gray-700 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800",
                      }}
                      search={{ state: item.state }}
                      params={{}}
                    >
                      {item.name}
                      {item.count ? (
                        <Badge
                          color="light"
                          className="ml-auto w-9 min-w-max justify-end whitespace-nowrap"
                        >
                          {item.count.toString()}
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
