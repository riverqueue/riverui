import { Badge } from "@components/Badge";
import Logo from "@components/Logo";
import { ArrowRightIcon } from "@heroicons/react/20/solid";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";

export default function PeriodicJobListEmptyState({
  hasAny,
}: {
  hasAny: boolean;
}) {
  return (
    <>
      {hasAny && (
        <div className="mx-4 mt-12 rounded-lg border-2 border-dashed border-gray-300 px-4 py-12 text-center">
          <CalendarDaysIcon
            aria-hidden="true"
            className="mx-auto size-12 text-slate-500 dark:text-slate-400"
          />
          <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
            No periodic jobs
          </h3>
          <p className="mt-8 text-sm text-slate-600 dark:text-slate-400">
            Check out{" "}
            <a href="https://riverqueue.com/docs/pro/durable-periodic-jobs">
              the documentation
            </a>{" "}
            to learn more about durable periodic jobs.
          </p>
        </div>
      )}

      {!hasAny && (
        <div className="flex justify-center">
          <div className="mx-4 mt-12 flex max-w-xl flex-col gap-6 overflow-hidden rounded-lg border border-slate-400/30 bg-white py-6 shadow-lg md:mt-20 dark:bg-slate-800">
            <div className="flex flex-col px-4 sm:px-6">
              <div className="flex grow">
                <Logo className="mt-1 mr-3 h-6 w-auto text-brand-primary dark:text-white" />
                <Badge color="blue">Pro</Badge>
              </div>
              <h3 className="mt-4 text-lg leading-6 font-medium text-slate-900 dark:text-white">
                Durable Periodic Jobs
              </h3>
            </div>
            <div className="flex flex-col gap-4 px-4 sm:px-6">
              <p className="text-sm text-slate-800 dark:text-slate-100">
                Create recurring jobs with durable scheduling and visibility
                into upcoming runs.
              </p>
              <p className="text-sm text-slate-800 dark:text-slate-100">
                Periodic jobs are included with River Pro. If you're already
                using Pro,{" "}
                <a
                  className="text-brand-primary"
                  href="https://riverqueue.com/docs/river-ui"
                >
                  upgrade your deployment
                </a>{" "}
                to access Pro features in the UI.
              </p>
            </div>
            <div className="flex gap-4 px-4 sm:px-6">
              <a
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm text-white hover:bg-blue-500 hover:text-white"
                href="https://riverqueue.com/docs/pro/durable-periodic-jobs"
              >
                Learn more
              </a>
              <a
                className="flex items-center rounded-lg bg-transparent px-4 py-2 text-sm text-slate-800 hover:text-slate-600 dark:text-slate-200 dark:hover:text-slate-400"
                href="https://riverqueue.com/docs/pro/durable-periodic-jobs"
              >
                Docs
                <ArrowRightIcon className="ml-2 size-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
