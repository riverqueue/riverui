import { Job } from "@services/jobs";
import RelativeTimeFormatter from "./RelativeTimeFormatter";
import { useState } from "react";
import clsx from "clsx";

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
    <div className="sm:col-span-2 border-slate-100 dark:border-slate-800 border-t py-6 px-4 sm:px-0">
      <div className="lg:px-0">
        <dt className="text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
          Errors
        </dt>
        <dd className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300 sm:mt-2">
          {job.errors.length === 0 ? (
            <>No errors</>
          ) : (
            <>
              <ol
                role="list"
                className="divide-y divide-slate-300 dark:divide-slate-700"
              >
                {errorsToDisplay.map((error) => (
                  <li key={error.attempt} className="py-4 sm:py-6">
                    <div className="flex items-start">
                      <p className="font-mono font-medium leading-5 text-slate-900 dark:text-slate-100">
                        {error.attempt.toString()}
                      </p>
                      <div className="ml-4 max-w-full overflow-hidden">
                        <h5
                          className={clsx(
                            "font-mono text-sm font-medium text-slate-900 dark:text-slate-100 mb-2",
                            isMultilineError(error) &&
                              "block whitespace-pre-wrap bg-slate-300/20 dark:bg-slate-700/20 px-4 py-2 -mt-2 rounded-md max-h-80 h-min overflow-y-auto resize-y"
                          )}
                          aria-description="Error message"
                        >
                          {error.error}
                        </h5>
                        {error.trace && (
                          <>
                            <h6 className="mt-4 mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Stack Trace:
                            </h6>
                            <pre
                              className="h-min max-h-80 overflow-x-auto bg-slate-300/10 text-sm text-slate-700 dark:bg-slate-700/10 dark:text-slate-300 px-4 py-2 whitespace-pre resize-y"
                              aria-description="Stack trace"
                            >
                              {error.trace}
                            </pre>
                          </>
                        )}
                        <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
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
