import { type AttemptError, Job } from "@services/jobs";
import clsx from "clsx";
import { useState } from "react";

import RelativeTimeFormatter from "./RelativeTimeFormatter";

type JobAttemptErrorsProps = {
  job: Job;
};

const defaultErrorDisplayCount = 5;

export default function JobAttemptErrors({ job }: JobAttemptErrorsProps) {
  const [showAllErrors, setShowAllErrors] = useState(false);
  const errorsToDisplay = showAllErrors
    ? job.errors.slice().reverse()
    : job.errors.slice(-1 * defaultErrorDisplayCount).reverse();

  const isMultilineError = (error: AttemptError) => {
    return error.error.includes("\n");
  };

  return (
    <div className="border-t border-slate-100 px-4 py-6 sm:col-span-2 sm:px-0 dark:border-slate-800">
      <div className="lg:px-0">
        <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
          Errors
        </dt>
        <dd className="mt-1 text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300">
          {job.errors.length === 0 ? (
            <>No errors</>
          ) : (
            <>
              <ol
                className="divide-y divide-slate-300 dark:divide-slate-700"
                role="list"
              >
                {errorsToDisplay.map((error) => (
                  <li className="py-4 sm:py-6" key={error.attempt}>
                    <div className="flex items-start">
                      <p className="font-mono leading-5 font-medium text-slate-900 dark:text-slate-100">
                        {error.attempt.toString()}
                      </p>
                      <div className="ml-4 max-w-full min-w-0 flex-1">
                        <h5
                          aria-description="Error message"
                          className={clsx(
                            "mb-2 font-mono text-sm font-medium text-slate-900 dark:text-slate-100",
                            isMultilineError(error) &&
                              "-mt-2 block h-min max-h-80 resize-y overflow-auto rounded-md bg-slate-300/20 px-4 py-2 whitespace-pre dark:bg-slate-700/20",
                          )}
                        >
                          {error.error}
                        </h5>
                        {error.trace && (
                          <>
                            <h6 className="mt-4 mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Stack Trace:
                            </h6>
                            <pre
                              aria-description="Stack trace"
                              className="h-min max-h-80 w-full resize-y overflow-x-auto bg-slate-300/10 px-4 py-2 text-sm whitespace-pre text-slate-700 dark:bg-slate-700/10 dark:text-slate-300"
                            >
                              {error.trace}
                            </pre>
                          </>
                        )}
                        <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
                          <RelativeTimeFormatter addSuffix time={error.at} />
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
                      className="mt-4 text-sm font-semibold text-indigo-600 hover:underline dark:text-slate-100"
                      onClick={() => setShowAllErrors(!showAllErrors)}
                      type="button"
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
