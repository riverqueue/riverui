import React, { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { MenuButton as HeadlessMenuButton } from "@headlessui/react";

import { Job } from "@services/jobs";
import { JobState } from "@services/types";
import { classNames } from "@utils/style";
import { StatesAndCounts } from "@services/states";
import { JobFilters } from "@components/JobFilters";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import TopNav from "@components/TopNav";
import { Dropdown, DropdownItem, DropdownMenu } from "@components/Dropdown";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import {
  JobStateFilterItem,
  jobStateFilterItems,
} from "@utils/jobStateFilterItems";

const states: { [key in JobState]: string } = {
  [JobState.Available]: "text-sky-500 bg-sky-100/10",
  [JobState.Cancelled]: "text-gray-500 bg-gray-100/10",
  [JobState.Completed]: "text-emerald-400 bg-emerald-400/10",
  [JobState.Discarded]: "text-rose-400 bg-rose-400/10",
  [JobState.Pending]: "text-rose-400 bg-rose-400/10",
  [JobState.Retryable]: "text-amber-500 bg-amber-100/10",
  [JobState.Running]: "text-indigo-400 bg-indigo-400/10",
  [JobState.Scheduled]: "text-rose-400 bg-rose-400/10",
};

const queueStates = {
  Active: "text-gray-400 bg-gray-400/10 ring-gray-400/20",
  Paused: "text-amber-400 bg-amber-400/10 ring-amber-400/30",
};

const timestampForRelativeDisplay = (job: Job): Date => {
  switch (job.state) {
    case JobState.Running:
      return job.attemptedAt ? job.attemptedAt : new Date();
    case JobState.Completed:
      return job.finalizedAt ? job.finalizedAt : new Date();
    default:
      return job.createdAt;
  }
};

const JobTimeDisplay = ({ job }: { job: Job }): JSX.Element => {
  return (
    <span>
      <RelativeTimeFormatter
        time={timestampForRelativeDisplay(job)}
        addSuffix
        includeSeconds
      />
    </span>
  );
};

type JobListItemProps = {
  job: Job;
};

const JobListItem = ({ job }: JobListItemProps) => (
  <li className="relative flex items-center space-x-4 py-3">
    <div className="min-w-0 flex-auto">
      <div className="flex items-center gap-x-3">
        <div
          className={classNames(
            states[job.state],
            "flex-none rounded-full p-1"
          )}
        >
          <div className="size-2 rounded-full bg-current" />
        </div>
        <h2 className="min-w-0 grow text-sm font-medium leading-6">
          <Link
            to="/jobs/$jobId"
            params={{ jobId: job.id }}
            className="flex gap-x-2 text-slate-900 dark:text-slate-200"
          >
            <span className="truncate">{job.kind}</span>
          </Link>
        </h2>
        <div className="text-right text-sm leading-6 text-slate-700 dark:text-slate-100">
          <JobTimeDisplay job={job} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-500 dark:text-gray-300">
        <div className="flex items-center gap-x-2">
          <span>{job.attempt.toString()}</span>
          <span>/</span>
          <span>{job.maxAttempts.toString()}</span>
        </div>
        <svg viewBox="0 0 2 2" className="size-0.5 flex-none fill-gray-400">
          <circle cx={1} cy={1} r={1} />
        </svg>
        <p className="grow truncate whitespace-nowrap">
          {JSON.stringify(job.args)}
        </p>
        <div
          className={classNames(
            queueStates.Active,
            "rounded-full flex-none py-1 px-2 text-xs font-medium ring-1 ring-inset self-end"
          )}
        >
          {job.queue}
        </div>
      </div>
    </div>
  </li>
);

type EmptySetIconProps = React.ComponentProps<"svg">;

const EmptySetIcon = (props: EmptySetIconProps) => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    stroke="currentColor"
    {...props}
  >
    <circle cx="100" cy="100" r="60" fill="none" strokeWidth="10" />
    <line x1="40" y1="40" x2="160" y2="160" strokeWidth="10" />
  </svg>
);

const EmptyState = () => (
  <div className="mt-16 text-center">
    <EmptySetIcon className="mx-auto size-12 text-gray-400" />
    <h3 className="mt-2 text-sm font-semibold text-gray-900">No jobs</h3>
  </div>
);

type JobRowsProps = {
  canShowFewer: boolean;
  canShowMore: boolean;
  jobs: Job[];
  showFewer: () => void;
  showMore: () => void;
};

const JobRows = ({
  canShowFewer,
  canShowMore,
  jobs,
  showFewer,
  showMore,
}: JobRowsProps) => {
  if (jobs.length === 0) {
    return <EmptyState />;
  }
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <ul role="list" className="divide-y divide-black/5 dark:divide-white/5">
        {jobs.map((job) => (
          <JobListItem key={job.id.toString()} job={job} />
        ))}
      </ul>
      <nav
        className="flex items-center justify-center border-t border-black/5 py-3 dark:border-white/5"
        aria-label="Pagination"
      >
        <button
          className={classNames(
            "relative inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 hover:dark:bg-slate-800 focus-visible:outline-offset-0"
          )}
          disabled={!canShowFewer}
          onClick={() => showFewer()}
        >
          Fewer
        </button>
        <button
          className="relative ml-3 inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-offset-0 dark:text-slate-100 dark:ring-slate-700 hover:dark:bg-slate-800"
          disabled={!canShowMore}
          onClick={() => showMore()}
        >
          More
        </button>
      </nav>
    </div>
  );
};

type JobListProps = {
  canShowFewer: boolean;
  canShowMore: boolean;
  loading?: boolean;
  jobs: Job[];
  showFewer: () => void;
  showMore: () => void;
  state: JobState;
  statesAndCounts: StatesAndCounts | undefined;
};

const JobList = (props: JobListProps) => {
  const { loading, state, statesAndCounts } = props;

  const stateFormatted = state.charAt(0).toUpperCase() + state.slice(1);
  const jobsInState = useMemo(() => {
    if (!statesAndCounts) {
      return 0;
    }
    return statesAndCounts[state] || 0;
  }, [state, statesAndCounts]);

  const filterItems = useMemo(
    () => jobStateFilterItems(statesAndCounts),
    [statesAndCounts]
  );

  return (
    <div className="h-full lg:pl-72">
      <TopNav>
        <header className="flex flex-1 items-center lg:hidden">
          <h1 className="hidden text-base font-semibold leading-6 text-slate-900 dark:text-slate-100 lg:inline">
            Jobs
          </h1>
          <Dropdown>
            <HeadlessMenuButton
              className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-1 text-slate-700 data-[active]:border-slate-200 data-[hover]:border-slate-200 dark:text-slate-300 dark:data-[active]:border-slate-700 dark:data-[hover]:border-slate-700"
              aria-label="Account options"
            >
              <span className="flex w-36 flex-1 items-center justify-between text-left">
                <span className="text-base block align-middle font-semibold">
                  {stateFormatted}
                </span>
                <span
                  className="ml-3 block w-9 min-w-max whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-center text-xs font-medium leading-5 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                  aria-hidden="true"
                >
                  {jobsInState.toString()}
                </span>
              </span>
              <ChevronUpDownIcon className="ml-auto mr-1 size-4 shrink-0 stroke-zinc-400" />
            </HeadlessMenuButton>
            <DropdownMenu className="z-40 min-w-[--button-width]">
              {filterItems.map((item: JobStateFilterItem) => (
                <DropdownItem
                  key={item.state}
                  to="/jobs"
                  className="group flex rounded-md p-2 text-sm font-semibold leading-6"
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
                  <span className="">{item.name}</span>
                  <span className="col-span-4 ml-auto w-9 min-w-max whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-center text-xs font-medium leading-5 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-gray-900 dark:text-white dark:ring-gray-700">
                    {item.count.toString()}
                  </span>
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
          {/* <JobFilters statesAndCounts={statesAndCounts} /> */}
        </header>
      </TopNav>

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-16 lg:z-40 lg:flex lg:w-72 lg:flex-col">
        <JobFilters statesAndCounts={statesAndCounts} />
      </div>

      {loading ? <div>Loading...</div> : <JobRows {...props}></JobRows>}
    </div>
  );
};

export default JobList;
