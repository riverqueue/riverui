import { JobState } from "@services/types";

import { Button } from "./Button";
import NotFoundPage from "./NotFoundPage";

type JobNotFoundProps = {
  jobId: bigint;
};

export default function JobNotFound({ jobId }: JobNotFoundProps) {
  return (
    <NotFoundPage
      action={
        <Button plain search={{ state: JobState.Available }} to="/jobs">
          Return to job list <span aria-hidden="true">&rarr;</span>
        </Button>
      }
      description={
        <>
          Sorry, there is no job with ID <code>{jobId.toString()}</code>.
        </>
      }
      heading="Job not found"
      title="Job Details"
    />
  );
}
