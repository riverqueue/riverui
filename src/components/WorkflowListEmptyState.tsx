import { Badge } from "@components/Badge";
import Logo from "@components/Logo";
import { ArrowRightIcon } from "@heroicons/react/20/solid";
import { RectangleGroupIcon } from "@heroicons/react/24/outline";

export default function WorkflowListEmptyState({
  workflowQueriesEnabled,
}: {
  workflowQueriesEnabled: boolean;
}) {
  return (
    <>
      {workflowQueriesEnabled && (
        <div className="flex justify-center">
          <div className="mx-4 mt-12 flex max-w-xl flex-col gap-6 overflow-hidden rounded-lg border border-slate-400/30 bg-white py-6 shadow-lg md:mt-20 dark:bg-slate-800">
            <div className="flex flex-col px-4 sm:px-6">
              <div className="flex grow">
                <RectangleGroupIcon
                  aria-hidden="true"
                  className="size-7 text-brand-primary dark:text-white"
                />
              </div>
              <h3 className="mt-4 text-lg leading-6 font-medium text-slate-900 dark:text-white">
                No workflows yet
              </h3>
            </div>
            <div className="flex flex-col gap-4 px-4 sm:px-6">
              <p className="text-sm text-slate-800 dark:text-slate-100">
                Workflows model a process as dependent tasks, making it easier
                to coordinate fan-out, fan-in, retries, and progress across
                related jobs.
              </p>
            </div>
            <div className="flex gap-4 px-4 sm:px-6">
              <a
                className="flex items-center rounded-lg bg-transparent py-2 pr-4 text-sm text-slate-800 hover:text-slate-600 dark:text-slate-200 dark:hover:text-slate-400"
                href="https://riverqueue.com/docs/pro/workflows"
              >
                Docs
                <ArrowRightIcon className="ml-2 size-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {!workflowQueriesEnabled && (
        <div className="flex justify-center">
          <div className="mx-4 mt-12 flex max-w-xl flex-col gap-6 overflow-hidden rounded-lg border border-slate-400/30 bg-white py-6 shadow-lg md:mt-20 dark:bg-slate-800">
            <div className="flex flex-col px-4 sm:px-6">
              <div className="flex grow">
                <Logo className="mt-1 mr-3 h-6 w-auto text-brand-primary dark:text-white" />
                <Badge color="blue">Pro</Badge>
              </div>
              <h3 className="mt-4 text-lg leading-6 font-medium text-slate-900 dark:text-white">
                Build faster with Workflows
              </h3>
            </div>
            <div className="flex flex-col gap-4 px-4 sm:px-6">
              <p className="text-sm text-slate-800 dark:text-slate-100">
                Model your jobs as a series of dependent tasks with Workflows.
                Tasks don't execute until all their dependencies have completed,
                and support fan-out and fan-in execution.
              </p>
              <p className="text-sm text-slate-800 dark:text-slate-100">
                Workflows are part of River Pro. If you're not using Pro yet,{" "}
                <a
                  className="text-brand-primary"
                  href="https://riverqueue.com/pro"
                >
                  learn about Workflows
                </a>
                . If you're already using Pro, ensure you've run all River Pro
                migrations against the configured schema to access workflow
                features in the UI.{" "}
              </p>
            </div>
            <div className="flex gap-4 px-4 sm:px-6">
              <a
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm text-white hover:bg-blue-500 hover:text-white"
                href="https://riverqueue.com/pro"
              >
                Learn more
              </a>
              <a
                className="flex items-center rounded-lg bg-transparent px-4 py-2 text-sm text-slate-800 hover:text-slate-600 dark:text-slate-200 dark:hover:text-slate-400"
                href="https://riverqueue.com/docs/pro/workflows"
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
