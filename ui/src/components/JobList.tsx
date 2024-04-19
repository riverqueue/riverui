import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTime } from "react-time-sync";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";

import { Job } from "@services/jobs";
import { JobState } from "@services/types";
import { classNames } from "@utils/style";
import { formatRelative } from "@utils/time";
import { StatesAndCounts } from "@services/states";
import { JobFilters } from "@components/JobFilters";
import TopNav from "@components/TopNav";

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

type RelativeTimeFormatterProps = {
  addSuffix?: boolean;
  includeSeconds?: boolean;
  humanize?: boolean;
  time: Date;
};

const RelativeTimeFormatter = ({
  addSuffix,
  includeSeconds,
  humanize = false,
  time,
}: RelativeTimeFormatterProps): string => {
  const nowSec = useTime();
  const relative = useMemo(() => {
    const now = new Date(nowSec * 1000);
    return formatRelative(time, { addSuffix, includeSeconds, humanize, now });
  }, [addSuffix, includeSeconds, humanize, nowSec, time]);

  return relative;
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

type JobListProps = {
  loading?: boolean;
  jobs: Job[];
  statesAndCounts: StatesAndCounts | undefined;
};

const JobList = ({ jobs, loading, statesAndCounts }: JobListProps) => {
  return (
    <div className="h-full lg:pl-72">
      <TopNav>
        <form className="relative" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <MagnifyingGlassIcon
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400"
            aria-hidden="true"
          />
          <input
            id="search-field"
            className="block size-full border-0 bg-transparent py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 dark:text-gray-100 sm:text-sm"
            placeholder="Search..."
            type="search"
            name="search"
          />
        </form>
      </TopNav>

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-16 lg:z-40 lg:flex lg:w-72 lg:flex-col">
        <JobFilters statesAndCounts={statesAndCounts} />
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ul
            role="list"
            className="divide-y divide-black/5 dark:divide-white/5"
          >
            {jobs.map((job) => (
              <JobListItem key={job.id.toString()} job={job} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default JobList;
