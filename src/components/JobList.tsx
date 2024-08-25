import React, { FormEvent, useCallback, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { MenuButton as HeadlessMenuButton } from "@headlessui/react";
import {
  ArrowUturnLeftIcon,
  ChevronUpDownIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import { Job } from "@services/jobs";
import { JobState } from "@services/types";
import { classNames } from "@utils/style";
import { StatesAndCounts } from "@services/states";
import { JobFilters } from "@components/JobFilters";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import TopNav from "@components/TopNav";
import { Dropdown, DropdownItem, DropdownMenu } from "@components/Dropdown";
import {
  JobStateFilterItem,
  jobStateFilterItems,
} from "@utils/jobStateFilterItems";
import { Badge } from "@components/Badge";
import { Button } from "@components/Button";
import { useSelected } from "@hooks/use-selected";
import { useShiftSelected } from "@hooks/use-shift-selected";
import { CustomCheckbox } from "./CustomCheckbox";
import ButtonForGroup from "./ButtonForGroup";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";

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
  checked: boolean;
  job: Job;
  onChangeSelect: (
    checked: boolean,
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
};

const JobListItem = ({ checked, job, onChangeSelect }: JobListItemProps) => (
  <li className="relative flex items-stretch space-x-4 py-1.5">
    <div className="flex items-center">
      <CustomCheckbox
        aria-label={`Select job ${job.id.toString()}`}
        checked={checked}
        name={`select_job_${job.id.toString()}`}
        onChange={onChangeSelect}
      />
    </div>
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
        <h2 className="min-w-0 grow text-sm font-medium leading-5">
          <Link
            to="/jobs/$jobId"
            params={{ jobId: job.id }}
            className="flex gap-x-2 text-slate-900 dark:text-slate-200"
          >
            <span className="truncate">{job.kind}</span>
          </Link>
        </h2>
        <div className="text-nowrap text-right text-sm leading-5 text-slate-700 dark:text-slate-100">
          <JobTimeDisplay job={job} />
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-x-2.5 text-xs leading-5 text-gray-500 dark:text-gray-300">
        <div className="flex items-center gap-x-2 font-semibold">
          <span>{job.attempt.toString()}</span>
          <span>/</span>
          <span>{job.maxAttempts.toString()}</span>
        </div>
        <svg viewBox="0 0 2 2" className="size-0.5 flex-none fill-gray-400">
          <circle cx={1} cy={1} r={1} />
        </svg>
        <p className="grow truncate whitespace-nowrap font-mono">
          {JSON.stringify(job.args)}
        </p>
        <Badge color="zinc" className="flex-none font-mono text-xs">
          {job.queue}
        </Badge>
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

function JobListActionButtons({
  cancel,
  className,
  deleteFn,
  jobIDs,
  retry,
  state,
}: {
  cancel: (jobIDs: bigint[]) => void;
  className?: string;
  deleteFn: (jobIDs: bigint[]) => void;
  jobIDs: bigint[];
  retry: (jobIDs: bigint[]) => void;
  state: JobState;
}) {
  // Can only delete jobs that aren't running:
  const deleteDisabled = state === JobState.Running;

  const deleteJob = (event: FormEvent) => {
    event.preventDefault();
    deleteFn(jobIDs);
  };

  // Can only cancel jobs that aren't already finalized (completed, discarded, cancelled):
  const cancelDisabled = [
    JobState.Cancelled,
    JobState.Completed,
    JobState.Discarded,
  ].includes(state);

  const cancelJob = (event: FormEvent) => {
    event.preventDefault();
    cancel(jobIDs);
  };

  // Enable immediate retry if the job is not running or pending:
  const retryDisabled = [JobState.Running, JobState.Pending].includes(state);
  const retryJob = (event: FormEvent) => {
    event.preventDefault();
    retry(jobIDs);
  };

  return (
    <span
      className={classNames(
        "inline-flex rounded-md shadow-sm mr-6",
        className || ""
      )}
    >
      <ButtonForGroup
        Icon={ArrowUturnLeftIcon}
        text="Retry"
        disabled={retryDisabled}
        onClick={retryJob}
      />
      <ButtonForGroup
        Icon={XCircleIcon}
        text="Cancel"
        disabled={cancelDisabled}
        onClick={cancelJob}
      />
      <ButtonForGroup
        Icon={TrashIcon}
        text="Delete"
        disabled={deleteDisabled}
        onClick={deleteJob}
      />
    </span>
  );
}

type JobRowsProps = {
  canShowFewer: boolean;
  canShowMore: boolean;
  cancelJobs: (jobIDs: bigint[]) => void;
  deleteJobs: (jobIDs: bigint[]) => void;
  jobs: Job[];
  retryJobs: (jobIDs: bigint[]) => void;
  setJobRefetchesPaused: (value: boolean) => void;
  showFewer: () => void;
  showMore: () => void;
  state: JobState;
};

const JobRows = ({
  canShowFewer,
  canShowMore,
  cancelJobs,
  deleteJobs,
  jobs,
  retryJobs,
  setJobRefetchesPaused,
  showFewer,
  showMore,
  state,
}: JobRowsProps) => {
  const {
    selected: selectedJobs,
    selectedSet,
    change: changeSelectedJobs,
    clear: clearSelectedJobs,
    add: addSelectedJob,
    remove: removeSelectedJob,
  } = useSelected([] as Array<bigint>);
  const jobIDs = useMemo(() => jobs.map((j) => j.id), [jobs]);
  const onChange = useShiftSelected(jobIDs, changeSelectedJobs);

  useEffect(() => {
    setJobRefetchesPaused(selectedJobs.length > 0);
  }, [selectedJobs, setJobRefetchesPaused]);

  useEffect(() => {
    // Reset selection when jobs list changes
    clearSelectedJobs();
  }, [jobs, clearSelectedJobs]);

  const handleSelectAll = useCallback(
    (checked: boolean, _event: React.ChangeEvent<HTMLInputElement>) => {
      if (checked) {
        addSelectedJob(jobIDs);
      } else {
        removeSelectedJob(jobIDs);
      }
    },
    [jobIDs, addSelectedJob, removeSelectedJob]
  );

  const isIndeterminate =
    selectedJobs.length > 0 && selectedJobs.length < jobs.length;

  if (jobs.length === 0) {
    return <EmptyState />;
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-12 items-center space-x-4 border-b border-slate-300 py-2 dark:border-slate-700 sm:justify-between">
          <CustomCheckbox
            aria-label={"Select all jobs"}
            className="grow-0"
            name={"select_all_jobs"}
            checked={selectedJobs.length > 0}
            indeterminate={isIndeterminate}
            onChange={handleSelectAll}
          />
          <JobListActionButtons
            cancel={cancelJobs}
            className={classNames(selectedJobs.length === 0 ? "invisible" : "")}
            deleteFn={deleteJobs}
            jobIDs={selectedJobs}
            retry={retryJobs}
            state={state}
          />
          {selectedJobs.length > 0 && (
            <>
              <div className="hidden grow text-sm text-slate-600 dark:text-slate-400 sm:block">
                {selectedJobs.length.toString()} selected
              </div>
              <Badge color="amber" className="hidden sm:flex">
                <ExclamationTriangleIcon className="size-4" />
                Updates paused
              </Badge>
            </>
          )}
        </div>
      </div>
      <ul
        role="list"
        className="grow divide-y divide-slate-200 px-4 dark:divide-slate-800 sm:px-6 lg:px-8"
      >
        {jobs.map((job) => (
          <JobListItem
            key={job.id.toString()}
            job={job}
            checked={selectedSet.has(job.id)}
            onChangeSelect={(_checked, event) => onChange(event, job.id)}
          />
        ))}
      </ul>
      <nav
        className="sticky inset-x-0 bottom-0 flex items-center justify-center border-t border-black/5 bg-white py-3 dark:border-white/5 dark:bg-slate-900"
        aria-label="Pagination"
      >
        <Button
          className="mx-2"
          color="light"
          disabled={!canShowFewer}
          onClick={() => showFewer()}
        >
          Fewer
        </Button>
        <Button
          className="mx-2"
          color="light"
          disabled={!canShowMore}
          onClick={() => showMore()}
        >
          More
        </Button>
      </nav>
    </div>
  );
};

type JobListProps = {
  canShowFewer: boolean;
  canShowMore: boolean;
  jobs: Job[];
  loading?: boolean;
  showFewer: () => void;
  showMore: () => void;
  state: JobState;
  statesAndCounts: StatesAndCounts | undefined;
} & JobRowsProps;

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
    <div className="lg:pl-56">
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
              <span className="flex min-w-36 flex-1 items-center justify-between text-left">
                <span className="block align-middle text-base font-semibold">
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
        </header>
      </TopNav>

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-16 lg:flex lg:w-56 lg:flex-col">
        <JobFilters statesAndCounts={statesAndCounts} />
      </div>

      {loading ? <div>Loading...</div> : <JobRows {...props}></JobRows>}
    </div>
  );
};

export default JobList;
