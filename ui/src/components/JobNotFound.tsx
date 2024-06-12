import { JobState } from "@services/types";
import { Button } from "./Button";
import TopNavTitleOnly from "./TopNavTitleOnly";

type JobNotFoundProps = {
  jobId: bigint;
};

export default function JobNotFound({ jobId }: JobNotFoundProps) {
  return (
    <>
      <TopNavTitleOnly title="Job Details" />

      <main className="grid min-h-full place-items-center px-6 py-24 sm:py-32 lg:px-8">
        <div className="text-center">
          <p className="text-base font-semibold text-brand-primary dark:text-blue-500">
            404
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Job not found
          </h1>
          <p className="mt-6 text-base leading-7 text-slate-600 dark:text-slate-400">
            Sorry, there is no job with ID <code>{jobId.toString()}</code>.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button plain to="/jobs" search={{ state: JobState.Available }}>
              Return to job list <span aria-hidden="true">&rarr;</span>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
