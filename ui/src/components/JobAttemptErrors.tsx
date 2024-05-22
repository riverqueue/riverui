import { Job } from "@services/jobs";
import RelativeTimeFormatter from "./RelativeTimeFormatter";
import { useState } from "react";

type JobAttemptErrorsProps = {
  job: Job;
};

const defaultErrorDisplayCount = 5;

export default function JobAttemptErrors({ job }: JobAttemptErrorsProps) {
  const [showAllErrors, setShowAllErrors] = useState(false);
  const errorsToDisplay = showAllErrors
    ? job.errors.slice().reverse()
    : job.errors.slice(-1 * defaultErrorDisplayCount).reverse();

  return (
    <div className="bg-white sm:col-span-2">
      <div className="px-4 lg:px-0">
        <dt className="text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
          Errors
        </dt>
        <dd className="mt-1 text-sm leading-6  text-slate-700 dark:text-slate-300 sm:mt-2">
          {job.errors.length === 0 ? (
            <>No errors</>
          ) : (
            <>
              <ol role="list" className="divide-y divide-gray-200">
                {errorsToDisplay.map((error) => (
                  <li key={error.attempt} className="p-4 sm:p-6">
                    <div className="flex items-start">
                      <p className="leading-5 text-slate-900 dark:text-slate-100">
                        {error.attempt.toString()}
                      </p>
                      <div className="ml-4">
                        <h5 className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                          {error.error}
                        </h5>
                        {error.trace && (
                          <pre className="mt-1 max-h-20 overflow-scroll bg-slate-300/10 text-sm text-slate-700 dark:bg-slate-700/10 dark:text-slate-300">
                            {error.trace}
                          </pre>
                        )}
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          <RelativeTimeFormatter time={error.at} addSuffix />
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              {job.errors.length > defaultErrorDisplayCount && (
                <>
                  <div className="mt-2 flex">
                    <button
                      type="button"
                      className="mt-4 text-sm font-semibold text-indigo-600 hover:underline dark:text-slate-100"
                      onClick={() => setShowAllErrors(!showAllErrors)}
                    >
                      {showAllErrors
                        ? "Show fewer"
                        : `Show all ${job.errors.length} errors`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </dd>
      </div>
    </div>
  );
}
