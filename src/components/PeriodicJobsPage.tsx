import PeriodicJobListEmptyState from "@components/PeriodicJobListEmptyState";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import { PeriodicJob } from "@services/periodicJobs";

type PeriodicJobsPageProps = {
  jobs: PeriodicJob[];
  loading: boolean;
};

const PeriodicJobList = ({ jobs, loading }: PeriodicJobsPageProps) => {
  return (
    <div className="size-full">
      <TopNavTitleOnly title="Periodic Jobs" />

      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div>Loading…</div>
        ) : jobs.length > 0 ? (
          <PeriodicJobTable jobs={jobs} />
        ) : (
          <PeriodicJobListEmptyState hasAny={true} />
        )}
      </div>
    </div>
  );
};

export default PeriodicJobList;

type PeriodicJobsTableProps = {
  jobs: PeriodicJob[];
};

const PeriodicJobTable = ({ jobs }: PeriodicJobsTableProps) => {
  return (
    <div className="-mx-4 mt-8 sm:-mx-0">
      <table className="min-w-full table-fixed divide-y divide-slate-300 dark:divide-slate-700">
        <thead>
          <tr>
            <th
              className="py-2.5 pr-3 pl-4 text-left text-sm font-semibold text-slate-900 sm:pl-0 dark:text-slate-100"
              scope="col"
            >
              ID
            </th>
            <th
              className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 md:table-cell dark:text-slate-100"
              scope="col"
            >
              Created
            </th>
            <th
              className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 sm:table-cell dark:text-slate-100"
              scope="col"
            >
              Next run
            </th>
            <th
              className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 lg:table-cell dark:text-slate-100"
              scope="col"
            >
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
          {jobs.map((job) => (
            <PeriodicJobListItem job={job} key={job.id} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

type PeriodicJobListItemProps = {
  job: PeriodicJob;
};

const PeriodicJobListItem = ({ job }: PeriodicJobListItemProps) => {
  return (
    <tr>
      <td className="w-full max-w-0 py-2 pr-3 pl-4 text-sm font-medium text-slate-700 sm:w-auto sm:max-w-none sm:pl-0 dark:text-slate-300">
        <span className="font-mono font-semibold dark:text-slate-100">
          {job.id}
        </span>
        <dl className="space-y-2 font-normal md:hidden">
          <div className="sm:hidden">
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Next run
            </dt>
            <dd className="mt-1 truncate">
              <RelativeTimeFormatter addSuffix time={job.nextRunAt} />
            </dd>
          </div>
          <div className="md:hidden">
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Created
            </dt>
            <dd className="mt-1 truncate">
              <RelativeTimeFormatter
                addSuffix
                includeSeconds
                time={job.createdAt}
              />
            </dd>
          </div>
          <div className="lg:hidden">
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Updated
            </dt>
            <dd className="mt-1 truncate">
              <RelativeTimeFormatter
                addSuffix
                humanize
                includeSeconds
                time={job.updatedAt}
              />
            </dd>
          </div>
        </dl>
      </td>
      <td className="hidden px-3 py-2 text-right text-sm text-slate-500 md:table-cell dark:text-slate-300">
        <RelativeTimeFormatter
          addSuffix
          humanize
          includeSeconds
          time={job.createdAt}
        />
      </td>
      <td className="hidden px-3 py-2 text-right text-sm text-slate-500 sm:table-cell dark:text-slate-300">
        <RelativeTimeFormatter addSuffix time={job.nextRunAt} />
      </td>
      <td className="hidden px-3 py-2 text-right text-sm text-slate-500 lg:table-cell dark:text-slate-300">
        <RelativeTimeFormatter
          addSuffix
          humanize
          includeSeconds
          time={job.updatedAt}
        />
      </td>
    </tr>
  );
};
