import { Badge } from "@components/Badge";
import { fetchSuggestions } from "@components/job-search/api";
import {
  Filter,
  FilterTypeId,
  JobSearch,
} from "@components/job-search/JobSearch";
import ListEmptyState from "@components/ListEmptyState";
import ListPagination from "@components/ListPagination";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import {
  DeadLetterJobListItem,
  fetchDeadLetterSuggestions,
} from "@services/deadLetterJobs";
import { Link } from "@tanstack/react-router";

type DeadLetterJobListProps = {
  canShowFewer: boolean;
  canShowMore: boolean;
  filterError?: string;
  initialFilters: Filter[];
  jobs: DeadLetterJobListItem[];
  // Set when a refresh fails. The last loaded jobs stay visible.
  loadError?: string;
  loading: boolean;
  onFiltersChange: (filters: Filter[]) => void;
  showFewer: () => void;
  showMore: () => void;
};

const DeadLetterJobRow = ({ job }: { job: DeadLetterJobListItem }) => (
  <li className="relative flex items-stretch space-x-4 py-1.5">
    <div className="min-w-0 flex-auto">
      <div className="flex items-center gap-x-3">
        <div className="flex-none rounded-full bg-rose-400/10 p-1 text-rose-400">
          <div className="size-2 rounded-full bg-current" />
        </div>
        <h2 className="min-w-0 grow text-sm leading-5 font-medium">
          <Link
            className="flex items-baseline gap-x-2 text-slate-900 dark:text-slate-200"
            params={{ jobId: job.id }}
            to="/dead-letter-jobs/$jobId"
          >
            <span className="truncate">{job.kind}</span>{" "}
            <span className="flex-none font-mono text-xs font-normal text-gray-500 dark:text-gray-400">
              #{job.id.toString()}
            </span>
          </Link>
        </h2>
        <div className="text-right text-sm leading-5 text-nowrap text-slate-700 dark:text-slate-100">
          {job.finalizedAt ? (
            <RelativeTimeFormatter
              addSuffix
              includeSeconds
              time={job.finalizedAt}
            />
          ) : (
            "–"
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-x-2.5 text-xs leading-5 text-gray-500 dark:text-gray-300">
        <div className="flex grow items-center gap-x-2 font-semibold">
          <span>{job.attempt.toString()}</span>
          <span>/</span>
          <span>{job.maxAttempts.toString()}</span>
        </div>
        <Badge className="flex-none font-mono text-xs" color="zinc">
          {job.queue}
        </Badge>
      </div>
    </div>
  </li>
);

export default function DeadLetterJobList({
  canShowFewer,
  canShowMore,
  filterError,
  initialFilters,
  jobs,
  loadError,
  loading,
  onFiltersChange,
  showFewer,
  showMore,
}: DeadLetterJobListProps) {
  const alert = filterError ?? loadError;

  return (
    <>
      <TopNavTitleOnly title="Dead Letters" />
      <div className="flex min-h-dvh flex-col">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center space-x-4 border-b border-slate-300 py-2 dark:border-slate-700">
            <JobSearch
              fetchSuggestions={fetchSuggestionsForDeadLetters}
              initialFilters={initialFilters}
              onFiltersChange={onFiltersChange}
              syncInitialFilters
            />
          </div>
          {alert && (
            <p
              className="border-b border-slate-200 py-2 text-sm text-red-600 dark:border-slate-800 dark:text-red-400"
              role="alert"
            >
              {alert}
            </p>
          )}
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-600 sm:px-6 lg:px-8 dark:text-slate-400">
            Loading…
          </p>
        ) : jobs.length === 0 ? (
          <div className="grow">
            {initialFilters.length ? (
              <ListEmptyState
                description="Try adjusting your filters to find what you're looking for."
                title="No dead letter jobs match these filters."
              />
            ) : (
              <ListEmptyState
                description={
                  <>
                    Discarded jobs appear here when the dead letter queue is
                    enabled with <code>Config.DeadLetter.Enabled</code> in River
                    Pro.
                  </>
                }
                title="No dead letter jobs."
              />
            )}
          </div>
        ) : (
          <>
            <ul
              className="grow divide-y divide-slate-200 px-4 sm:px-6 lg:px-8 dark:divide-slate-800"
              role="list"
            >
              {jobs.map((job) => (
                <DeadLetterJobRow job={job} key={job.id.toString()} />
              ))}
            </ul>
            <ListPagination
              canShowFewer={canShowFewer}
              canShowMore={canShowMore}
              showFewer={showFewer}
              showMore={showMore}
            />
          </>
        )}
      </div>
    </>
  );
}

async function fetchSuggestionsForDeadLetters(
  type: FilterTypeId,
  query: string,
  selectedValues: string[],
  signal?: AbortSignal,
): Promise<string[]> {
  if (type === FilterTypeId.KIND || type === FilterTypeId.QUEUE) {
    return fetchDeadLetterSuggestions(
      type === FilterTypeId.KIND ? "job_kind" : "queue_name",
      query,
      selectedValues,
      signal,
    );
  }
  return fetchSuggestions(type, query, selectedValues, signal);
}
