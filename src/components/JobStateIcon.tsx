import { JobState } from "@services/types";
import clsx from "clsx";

const stateClasses: Record<JobState, string> = {
  [JobState.Available]: "text-teal-200 bg-teal-200/10",
  [JobState.Cancelled]: "text-gray-500 bg-gray-100/10",
  [JobState.Completed]: "text-green-400 bg-green-400/10",
  [JobState.Discarded]: "text-rose-400 bg-rose-400/10",
  [JobState.Pending]: "text-indigo-400 bg-indigo-400/10",
  [JobState.Retryable]: "text-amber-500 bg-amber-100/10",
  [JobState.Running]: "text-teal-500 bg-teal-500/10",
  [JobState.Scheduled]: "text-cyan-400 bg-cyan-400/10",
};

type JobStateIconProps = {
  state: JobState;
} & React.ComponentPropsWithoutRef<"div">;

export default function JobStateIcon({ className, state }: JobStateIconProps) {
  return (
    <div className={clsx("rounded-full p-1", stateClasses[state], className)}>
      <div className="size-2 rounded-full bg-current" />
    </div>
  );
}
