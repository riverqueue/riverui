import ConfirmationDialog from "@components/ConfirmationDialog";
import HaltingJobDeleteDialog from "@components/HaltingJobDeleteDialog";
import { type JobSequenceStatus } from "@services/sequences";

// DeleteJobConfirmation confirms deleting a job. A job that's halting its
// sequence gets a dialog explaining that the jobs behind it will run without
// it, and offering Retry instead.
export default function DeleteJobConfirmation({
  job,
  onClose,
  onDelete,
  onRetry,
  open,
  sequence,
}: {
  job: { id: bigint };
  onClose: () => void;
  onDelete: () => void;
  onRetry: () => void;
  open: boolean;
  sequence?: JobSequenceStatus;
}) {
  const jobSequence = sequence?.error ? undefined : sequence?.jobSequence;
  const head = jobSequence?.sequence.head;
  const pendingCount = jobSequence?.sequence.pendingCount;
  if (jobSequence?.halting && head && pendingCount) {
    const { haltedBy } = jobSequence.sequence;
    return (
      <HaltingJobDeleteDialog
        earlierHalt={haltedBy && haltedBy.id !== job.id ? haltedBy : null}
        head={head}
        jobId={job.id}
        onClose={onClose}
        onDelete={onDelete}
        onRetry={onRetry}
        open={open}
        pendingCount={pendingCount}
      />
    );
  }

  return (
    <ConfirmationDialog
      confirmText="Delete job"
      description={
        <>
          This permanently deletes job{" "}
          <span className="font-mono">{job.id.toString()}</span>. This action
          cannot be undone.
        </>
      }
      onClose={onClose}
      onConfirm={onDelete}
      open={open}
      title="Delete job?"
    />
  );
}
