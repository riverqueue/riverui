import { fetchSuggestions } from "@components/job-search/api";
import {
  Filter,
  FilterTypeId,
  JobSearch,
} from "@components/job-search/JobSearch";
import {
  DeadLetterJobListItem,
  fetchDeadLetterSuggestions,
} from "@services/deadLetterJobs";
import { Link } from "@tanstack/react-router";

import { Button } from "./Button";
import RelativeTimeFormatter from "./RelativeTimeFormatter";
import TopNavTitleOnly from "./TopNavTitleOnly";

export default function DeadLetterJobList({
  canShowFewer,
  canShowMore,
  filterError,
  initialFilters,
  jobs,
  loading,
  onFiltersChange,
  showFewer,
  showMore,
}: {
  canShowFewer: boolean;
  canShowMore: boolean;
  filterError?: string;
  initialFilters: Filter[];
  jobs: DeadLetterJobListItem[];
  loading: boolean;
  onFiltersChange: (filters: Filter[]) => void;
  showFewer: () => void;
  showMore: () => void;
}) {
  return (
    <>
      <TopNavTitleOnly title="Dead Letters" />
      <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Discarded jobs retained in the dead letter queue. Select a job to
          inspect its failures and retry it.
        </p>
        <JobSearch
          fetchSuggestions={fetchSuggestionsForDeadLetters}
          initialFilters={initialFilters}
          onFiltersChange={onFiltersChange}
          syncInitialFilters
        />
        {filterError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {filterError}
          </p>
        )}
        {loading ? (
          <p>Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="py-12 text-center text-slate-500">
            {initialFilters.length
              ? "No dead letter jobs match these filters."
              : "No dead letter jobs."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-slate-300 text-left text-sm dark:divide-slate-700">
                <thead>
                  <tr>
                    <th className="px-3 py-3" scope="col">
                      Job
                    </th>
                    <th className="px-3 py-3" scope="col">
                      Queue
                    </th>
                    <th className="px-3 py-3" scope="col">
                      Attempts
                    </th>
                    <th className="px-3 py-3" scope="col">
                      Discarded
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {jobs.map((job) => (
                    <tr key={job.id.toString()}>
                      <td className="px-3 py-4">
                        <Link
                          className="font-mono text-brand-primary hover:underline dark:text-blue-400"
                          params={{ jobId: job.id }}
                          to="/dead-letter-jobs/$jobId"
                        >
                          {job.kind}{" "}
                          <span className="text-xs">#{job.id.toString()}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-4 font-mono">{job.queue}</td>
                      <td className="px-3 py-4">
                        {job.attempt} / {job.maxAttempts}
                      </td>
                      <td className="px-3 py-4">
                        {job.finalizedAt ? (
                          <RelativeTimeFormatter
                            addSuffix
                            time={job.finalizedAt}
                          />
                        ) : (
                          "–"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav
              aria-label="Pagination"
              className="sticky inset-x-0 bottom-0 flex items-center justify-center border-t border-black/5 bg-white py-3 dark:border-white/5 dark:bg-slate-900"
            >
              <Button
                className="mx-2"
                color="light"
                disabled={!canShowFewer}
                onClick={showFewer}
              >
                Fewer
              </Button>
              <Button
                className="mx-2"
                color="light"
                disabled={!canShowMore}
                onClick={showMore}
              >
                More
              </Button>
            </nav>
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
): Promise<string[]> {
  if (type === FilterTypeId.KIND || type === FilterTypeId.QUEUE) {
    return fetchDeadLetterSuggestions(
      type === FilterTypeId.KIND ? "job_kind" : "queue_name",
      query,
      selectedValues,
    );
  }
  return fetchSuggestions(type, query, selectedValues);
}
