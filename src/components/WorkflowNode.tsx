import type { Node, NodeProps } from "@xyflow/react";

import { TaskStateIcon } from "@components/TaskStateIcon";
import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import clsx from "clsx";
import { differenceInSeconds } from "date-fns";
import { memo, useEffect, useMemo } from "react";
import { useTime } from "react-time-sync";

export type WorkflowNodeData = {
  hasDownstreamDeps: boolean;
  hasUpstreamDeps: boolean;
  job: JobWithKnownMetadata;
};

type WorkflowNode = Node<WorkflowNodeData, "workflow">;

const WorkflowNode = memo(
  ({ data, isConnectable, selected }: NodeProps<WorkflowNode>) => {
    const { hasDownstreamDeps, hasUpstreamDeps, job } = data;
    const updateNodeInternals = useUpdateNodeInternals();

    // Ask xyflow to re-measure this custom node after mount/updates so MiniMap gets correct bounds
    useEffect(() => {
      updateNodeInternals(String(job.id));
    }, [job.id, updateNodeInternals]);

    return (
      <div
        className={clsx(
          "w-64 overflow-hidden rounded-xl border-2 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
          selected &&
            "shadow-lg ring-2 ring-brand-primary ring-offset-2 ring-offset-white dark:shadow-white/20 dark:ring-offset-slate-900",
        )}
        key={job.id}
      >
        <Handle
          className={clsx(
            "left-[-7px] size-4 border-4 border-slate-50 bg-slate-300 dark:border-slate-800 dark:bg-slate-600",
            hasUpstreamDeps || "opacity-0",
          )}
          isConnectable={isConnectable}
          position={Position.Left}
          style={{ top: 30 }}
          type="target"
        />
        <Handle
          className={clsx(
            "right-[-7px] size-4 border-4 border-slate-50 bg-slate-300 dark:border-slate-800 dark:bg-slate-600",
            hasDownstreamDeps || "opacity-0",
          )}
          isConnectable={isConnectable}
          position={Position.Right}
          style={{ top: 30 }}
          type="source"
        />
        <div className="-my-3 flex items-center px-3 py-4">
          <div className="flex-none">
            <TaskStateIcon className="mr-3 size-6" jobState={job.state} />
          </div>
          <dl className="min-w-0 flex-1 text-sm leading-6 dark:divide-slate-800">
            <div>
              <dt className="sr-only">Kind</dt>
              <dd className="gap-x-2 truncate font-bold text-slate-900 dark:text-slate-100">
                {job.kind}
              </dd>
            </div>
            <div className="flex-none">
              <dt className="sr-only">Task Name</dt>
              <dd className="truncate font-mono text-slate-700 dark:text-slate-300">
                {job.metadata.task}
              </dd>
            </div>
          </dl>
          <div className="flex-none text-sm text-slate-500 dark:text-slate-300">
            <JobDuration job={job} />
          </div>
        </div>
      </div>
    );
  },
);

export default WorkflowNode;

const JobDuration = ({ job }: { job: JobWithKnownMetadata }) => {
  switch (job.state) {
    case JobState.Available:
      return (
        <DurationMicro
          startTime={
            job.metadata.workflow_staged_at
              ? new Date(job.metadata.workflow_staged_at)
              : job.scheduledAt!
          }
        />
      );
    case JobState.Cancelled:
      return "–";
    case JobState.Completed:
      return (
        <DurationMicro
          endTime={job.finalizedAt!}
          startTime={job.attemptedAt!}
        />
      );
    case JobState.Discarded:
      return "–";
    case JobState.Pending:
      return "–";
    case JobState.Retryable:
      return "–";
    case JobState.Running:
      return <DurationMicro startTime={job.attemptedAt!} />;
    case JobState.Scheduled:
      return <DurationMicro endTime={job.attemptedAt!} />;
  }

  return "–";
};

const DurationMicro = ({
  endTime,
  startTime,
}: {
  endTime?: Date;
  startTime?: Date;
}) => {
  const nowSec = useTime();
  const now = useMemo(() => new Date(nowSec * 1000), [nowSec]);
  const start = startTime || now;
  const end = endTime || now;

  return formatDurationShortApprox(end, start);
};

function formatDurationShortApprox(dateA: Date, dateB: Date): string {
  const totalSeconds = differenceInSeconds(dateA, dateB);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hasHours = hours !== 0;
  const hasMinutes = hasHours || minutes !== 0;

  const zeroPad = (num: number, isLeadingGroup: boolean = false): string =>
    isLeadingGroup ? String(num) : String(num).padStart(2, "0");

  if (hasHours) return `${hours}h${zeroPad(minutes)}m`;

  if (hasMinutes) return `${minutes}m${zeroPad(seconds)}s`;

  return `${seconds}s`;
}
