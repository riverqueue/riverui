import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import clsx from "clsx";
import { JobWithKnownMetadata } from "@services/jobs";
import JobStateIcon from "./JobStateIcon";
import { capitalize } from "@utils/string";

export type WorkflowNodeData = {
  hasDownstreamDeps: boolean;
  hasUpstreamDeps: boolean;
  job: JobWithKnownMetadata;
};

const WorkflowNode = memo(
  ({ data, isConnectable }: NodeProps<WorkflowNodeData>) => {
    const { hasDownstreamDeps, hasUpstreamDeps, job } = data;

    return (
      <div className="w-52 overflow-hidden rounded-xl border-2 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <Handle
          type="target"
          position={Position.Left}
          style={{ top: 30 }}
          className={clsx(
            "left-[-9px] size-5 border-[6px] border-slate-50 bg-slate-300 dark:border-slate-800 dark:bg-slate-600",
            hasUpstreamDeps || "opacity-0"
          )}
          isConnectable={isConnectable}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={{ top: 30 }}
          className={clsx(
            "right-[-9px] size-5 border-[6px] border-slate-50 bg-slate-300 dark:border-slate-800 dark:bg-slate-600",
            hasDownstreamDeps || "opacity-0"
          )}
          isConnectable={isConnectable}
        />
        <div className="flex items-center justify-between gap-x-2 truncate border-b border-slate-900/5 bg-slate-50 p-4 font-semibold text-slate-900 dark:border-slate-100/5 dark:bg-slate-700 dark:text-slate-100">
          <div>{job.kind}</div>
        </div>
        <dl className="-my-3 divide-y divide-slate-100 p-4 text-sm leading-6 dark:divide-slate-800">
          <div className="flex justify-between gap-x-4 py-3">
            <dt className="text-nowrap text-slate-500 dark:text-slate-300">
              State
            </dt>
            <dd className="flex items-center gap-x-2 text-slate-500 dark:text-slate-100">
              <JobStateIcon state={job.state} />
              {capitalize(job.state)}
            </dd>
          </div>
          <div className="flex justify-between gap-x-4 truncate py-3">
            <dt className="text-nowrap text-slate-500 dark:text-slate-300">
              Task
            </dt>
            <dd className="font-mono text-slate-700 dark:text-slate-100">
              {job.metadata.task}
            </dd>
          </div>
          <div className="flex justify-between gap-x-4 py-3">
            <dt className="text-nowrap text-slate-500 dark:text-slate-300">
              ID
            </dt>
            <dd className="truncate text-slate-700 dark:text-slate-100">
              <Link
                to="/jobs/$jobId"
                params={{ jobId: job.id }}
                className="flex gap-x-2 font-mono text-slate-900 dark:text-slate-200"
              >
                <span className="truncate">{job.id.toString()}</span>
              </Link>
            </dd>
          </div>
        </dl>
      </div>
    );
  }
);

export default WorkflowNode;
