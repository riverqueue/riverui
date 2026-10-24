import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { Job } from "@services/jobs";

import ButtonForGroup from "./ButtonForGroup";
import { JobDetailView } from "./JobDetail";

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
    <JobDetailView
      actions={
        <span className="isolate inline-flex rounded-md shadow-xs">
          <ButtonForGroup
            disabled={retryPending}
            Icon={ArrowUturnLeftIcon}
            onClick={retry}
            text={retryPending ? "Retrying…" : "Retry job"}
          />
        </span>
      }
      job={job}
      notice="Retrying removes this job from the dead letter queue and enqueues a new job with the same args and a fresh attempt history."
      title="Dead Letter Job"
    />
  );
}
