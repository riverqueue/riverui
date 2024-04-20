import { Link } from "@tanstack/react-router";

import { JobState } from "@services/types";
import Logo from "@components/Logo";
import { StatesAndCounts } from "@services/states";

type jobStateFilterItem = {
  name: string;
  count: bigint;
  state: JobState;
};

type SidebarProps = {
  statesAndCounts?: StatesAndCounts;
};

export const JobFilters: (arg0: SidebarProps) => JSX.Element = ({
  statesAndCounts,
}) => {
  const getCount = (state: JobState): bigint => {
    if (statesAndCounts) {
      return BigInt(statesAndCounts[state]);
    }
    return BigInt(0);
  };

  const jobStateFilterItems: jobStateFilterItem[] = [
    {
      name: "Pending",
      state: JobState.Pending,
      count: getCount(JobState.Pending),
    },
    {
      name: "Scheduled",
      state: JobState.Scheduled,
      count: getCount(JobState.Scheduled),
    },
    {
      name: "Available",
      state: JobState.Available,
      count: getCount(JobState.Available),
    },
    {
      name: "Running",
      state: JobState.Running,
      count: getCount(JobState.Running),
    },
    {
      name: "Retryable",
      state: JobState.Retryable,
      count: getCount(JobState.Retryable),
    },
    {
      name: "Cancelled",
      state: JobState.Cancelled,
      count: getCount(JobState.Cancelled),
    },
    {
      name: "Discarded",
      state: JobState.Discarded,
      count: getCount(JobState.Discarded),
    },
    {
      name: "Completed",
      state: JobState.Completed,
      count: getCount(JobState.Completed),
    },
  ];

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mt-3 flex h-10 shrink-0 items-center text-slate-900 dark:text-slate-100">
        <Logo className="h-full w-auto" />
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-4">
          <li>
            <div className="text-xs font-semibold leading-6 text-slate-500 dark:text-slate-500">
              Job State
            </div>
            <ul role="list" className="-mx-2 mt-2 space-y-1">
              {jobStateFilterItems.map((item) => {
                return (
                  <li key={item.name}>
                    <Link
                      to="/jobs"
                      className="group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6"
                      activeProps={{
                        className:
                          "bg-gray-50 dark:bg-gray-800 text-indigo-600 dark:text-slate-100",
                      }}
                      inactiveProps={{
                        className:
                          "text-gray-700 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800",
                      }}
                      search={{ state: item.state }}
                      startTransition={true}
                      params={{}}
                    >
                      {item.name}
                      {item.count ? (
                        <span
                          className="ml-auto w-9 min-w-max whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-center text-xs font-medium leading-5 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                          aria-hidden="true"
                        >
                          {item.count.toString()}
                        </span>
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