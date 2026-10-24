import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { Job } from "@services/jobs";

import { Button } from "./Button";
import JobAttempts from "./JobAttempts";
import JSONTextView from "./JSONTextView";
import JSONView from "./JSONView";
import RelativeTimeFormatter from "./RelativeTimeFormatter";
import TopNavTitleOnly from "./TopNavTitleOnly";

export default function DeadLetterJobDetail({
  job,
  retry,
  retryPending,
}: {
  job: Job;
  retry: () => void;
  retryPending: boolean;
}) {
  return (
    <>
      <TopNavTitleOnly title="Dead Letter Job" />
      <div className="space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <Button outline to="/dead-letter-jobs">
          Return to dead letters
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{job.kind}</h2>
            <p className="mt-2 font-mono text-sm text-slate-500">
              ID: {job.id.toString()}
            </p>
          </div>
          <Button disabled={retryPending} onClick={retry}>
            <ArrowUturnLeftIcon data-slot="icon" />
            {retryPending ? "Retrying…" : "Retry job"}
          </Button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Retrying removes this job from the dead letter queue and enqueues a
          new job with the same args and a fresh attempt history.
        </p>
        <dl className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-4">
          <div>
            <dt className="font-semibold">Queue</dt>
            <dd className="mt-2 font-mono">{job.queue}</dd>
          </div>
          <div>
            <dt className="font-semibold">Attempts</dt>
            <dd className="mt-2">
              {job.attempt} / {job.maxAttempts}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Created</dt>
            <dd className="mt-2">
              <RelativeTimeFormatter addSuffix time={job.createdAt} />
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Discarded</dt>
            <dd className="mt-2">
              {job.finalizedAt ? (
                <RelativeTimeFormatter addSuffix time={job.finalizedAt} />
              ) : (
                "–"
              )}
            </dd>
          </div>
        </dl>
        <dl className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="mb-2 text-sm font-semibold">Args</dt>
            <dd>
              <JSONTextView copyTitle="Args" text={job.argsRaw} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="mb-2 text-sm font-semibold">Metadata</dt>
            <dd>
              <JSONView copyTitle="Metadata" data={job.metadata} />
            </dd>
          </div>
          <JobAttempts job={job} />
        </dl>
      </div>
    </>
  );
}
