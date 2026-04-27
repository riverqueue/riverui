import type { WorkflowTask, WorkflowTaskWaitReason } from "@services/workflows";
import type { Node, NodeProps } from "@xyflow/react";

import { TaskStateIcon } from "@components/TaskStateIcon";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { JobState } from "@services/types";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import clsx from "clsx";
import { differenceInSeconds } from "date-fns";
import { memo, type ReactElement, useEffect, useMemo } from "react";
import { useTime } from "react-time-sync";

import { switchHandleCenterGap } from "./workflowDiagramConstants";

const handleStyleClasses =
  "size-3.5 border-2 border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800";

export type WorkflowNodeData = {
  hasDownstreamDeps: boolean;
  hasUpstreamDeps: boolean;
  job: WorkflowTask;
  onSelect?: () => void;
  waitReason: WorkflowTaskWaitReason;
};

type WorkflowNode = Node<WorkflowNodeData, "workflow">;

const WorkflowNode = memo(
  ({ data, isConnectable, selected }: NodeProps<WorkflowNode>) => {
    const { hasDownstreamDeps, hasUpstreamDeps, job, onSelect, waitReason } =
      data;
    const updateNodeInternals = useUpdateNodeInternals();
    const duration = getJobDuration(job);

    useEffect(() => {
      updateNodeInternals(String(job.id));
    }, [job.id, updateNodeInternals]);

    const tooltip = job.wait ? getWaitTooltipText(job.wait) : undefined;

    const handleSelect = (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect?.();
    };

    return (
      <div
        className={clsx("nodrag nopan relative w-64 cursor-pointer")}
        key={job.id}
        onPointerDownCapture={handleSelect}
      >
        {job.wait ? (
          <CircuitSwitchHandle
            activelyBlocking={waitReason === "wait"}
            isConnectable={isConnectable}
            tooltip={tooltip}
            visible={hasUpstreamDeps}
            wait={job.wait}
          />
        ) : (
          <Handle
            className={clsx(
              "left-px",
              handleStyleClasses,
              hasUpstreamDeps || "opacity-0",
            )}
            isConnectable={isConnectable}
            position={Position.Left}
            style={{ top: "50%" }}
            type="target"
          />
        )}
        <Handle
          className={clsx(
            "right-px",
            handleStyleClasses,
            hasDownstreamDeps || "opacity-0",
          )}
          isConnectable={isConnectable}
          position={Position.Right}
          style={{ top: "50%" }}
          type="source"
        />
        <div
          className={clsx(
            "overflow-hidden rounded-xl border-2 bg-white dark:bg-slate-800",
            getNodeBorderClasses(job.state),
            selected &&
              "shadow-lg ring-2 ring-brand-primary ring-offset-2 ring-offset-white dark:shadow-white/20 dark:ring-offset-slate-900",
          )}
          onPointerDownCapture={handleSelect}
        >
          <WorkflowNodeContent duration={duration} job={job} />
        </div>
      </div>
    );
  },
);

export default WorkflowNode;

// ---------------------------------------------------------------------------
// Shared node content (used by both variants and original)
// ---------------------------------------------------------------------------

const WorkflowNodeContent = ({
  duration,
  job,
}: {
  duration: ReturnType<typeof getJobDuration>;
  job: WorkflowTask;
}) => (
  <div className="pointer-events-none flex items-center px-3 py-3">
    <div className="flex-none">
      <LeadingStateIcon job={job} />
    </div>
    <dl className="min-w-0 flex-1 text-sm leading-6 dark:divide-slate-800">
      <div>
        <dt className="sr-only">Kind</dt>
        <dd className="gap-x-2 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
          {job.kind}
        </dd>
      </div>
      <div className="flex-none">
        <dt className="sr-only">Task Name</dt>
        <dd className="truncate font-mono text-xs text-slate-700 dark:text-slate-300">
          {job.name}
        </dd>
      </div>
    </dl>
    {duration ? (
      <div className="flex-none text-sm text-slate-500 dark:text-slate-300">
        {duration}
      </div>
    ) : null}
  </div>
);

// ---------------------------------------------------------------------------
// LineWithBarHandle — three sibling elements in the node container:
//   1. Left circle div (post) — absolute-positioned
//   2. Line + bar SVG — absolute-positioned between the circles
//   3. Handle div (right circle) — positioned by ReactFlow on the node edge
// When blocking, the line terminates partway across the gap at a short
// vertical bar; when resolved, the line extends through to the right circle
// and the bar fades/scales away.
// All three elements use the same classes as standard handles for
// pixel-perfect matching.
// ---------------------------------------------------------------------------

const switchHandleClasses = clsx("left-px", handleStyleClasses);

// Distance between circle centers (px).
const switchGap = switchHandleCenterGap;
const switchHandleDiameter = 14;
const switchHandleRadius = switchHandleDiameter / 2;
const switchHandleAnchorLeftOffset = 1;

// Matches the dependency-edge stroke so the gate reads as a natural
// terminal segment of the incoming edge.
const leverStrokeWidth = 2;

// SVG viewBox origin at the left circle center. The line spans the visible
// gap between the two circles, revealed via stroke-dashoffset so its tip
// tracks the bar marker when blocking.
const leverVbWidth = switchGap;
const leverVbHeight = leverStrokeWidth + 2;
const leverCy = leverVbHeight / 2;
const leverLineStartX = switchHandleRadius;
const leverLineEndX = switchGap - switchHandleRadius + 1;
const linePathLength = leverLineEndX - leverLineStartX;

// Vertical bar sits at ~45% across the visible gap; 12px tall so it reads
// as a definite marker without dominating the handle circles.
const barCx = leverLineStartX + linePathLength * 0.45;
const barHalfHeight = 6;
const barStroke = 1.75;
const blockingHiddenLength = leverLineEndX - barCx;

const CircuitSwitchHandle = ({
  activelyBlocking,
  isConnectable,
  tooltip,
  visible,
  wait,
}: {
  activelyBlocking: boolean;
  isConnectable: boolean;
  tooltip?: string;
  visible: boolean;
  wait: NonNullable<WorkflowTask["wait"]>;
}) => {
  const blocking = isWaitBlocking(wait);
  const leftCircleLeft = -(
    switchGap +
    switchHandleRadius -
    switchHandleAnchorLeftOffset
  );

  return (
    <>
      {/* Gate arm — rendered first so it layers behind the circles */}
      <svg
        aria-hidden="true"
        className={clsx(
          "workflow-gate-lever absolute",
          !visible && "opacity-0",
        )}
        data-test-workflow-gate-phase={wait.phase}
        fill="none"
        style={{
          height: leverVbHeight,
          left: leftCircleLeft + switchHandleRadius,
          overflow: "visible",
          pointerEvents: "none",
          top: "50%",
          transform: "translateY(-50%)",
          width: leverVbWidth,
        }}
        viewBox={`0 0 ${leverVbWidth} ${leverVbHeight}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          stroke="currentColor"
          strokeDasharray={`${linePathLength} ${linePathLength}`}
          strokeLinecap="round"
          strokeWidth={leverStrokeWidth}
          style={{
            strokeDashoffset: blocking ? blockingHiddenLength : 0,
            transition: "stroke-dashoffset 0.35s ease-in-out",
          }}
          x1={leverLineStartX}
          x2={leverLineEndX}
          y1={leverCy}
          y2={leverCy}
        />
        <g
          className={clsx(
            activelyBlocking && "text-amber-500/80 dark:text-amber-400/60",
          )}
          style={{
            opacity: blocking ? 1 : 0,
            transform: blocking ? "scale(1)" : "scale(0.2)",
            transformOrigin: `${barCx}px ${leverCy}px`,
            transition:
              "opacity 0.25s ease-in-out, transform 0.25s ease-in-out",
          }}
        >
          <line
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={barStroke}
            x1={barCx}
            x2={barCx}
            y1={leverCy - barHalfHeight}
            y2={leverCy + barHalfHeight}
          />
        </g>
      </svg>

      {/* Left circle — post */}
      <div
        className={clsx(
          "absolute rounded-full",
          handleStyleClasses,
          getGateHingeClasses(),
          !visible && "opacity-0",
        )}
        style={{
          left: leftCircleLeft,
          pointerEvents: "none",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />

      {/* Tooltip hover target — spans the full gate area */}
      {tooltip ? (
        <div
          className={clsx("absolute", !visible && "opacity-0")}
          style={{
            height: 20,
            left: leftCircleLeft,
            top: "50%",
            transform: "translateY(-50%)",
            width: switchGap + switchHandleDiameter,
          }}
          title={tooltip}
        />
      ) : null}

      {/* Right circle — the actual Handle, positioned by ReactFlow */}
      <Handle
        className={clsx(switchHandleClasses, !visible && "opacity-0")}
        isConnectable={isConnectable}
        position={Position.Left}
        style={{ top: "50%" }}
        type="target"
      />
    </>
  );
};

const getWaitTooltipText = (
  wait: NonNullable<WorkflowTask["wait"]>,
): string => {
  const parts: string[] = [getWaitStatusLabel(wait)];

  if (wait.summary) {
    parts.push(
      wait.phase === "resolved" ? `Resolved by: ${wait.summary}` : wait.summary,
    );
  }
  if (wait.inputs.signals.length > 0) {
    parts.push(
      `Signals: ${wait.inputs.signals.map((signal) => signal.key).join(", ")}`,
    );
  }
  if (wait.inputs.timers.length > 0) {
    parts.push(
      `Timers: ${wait.inputs.timers.map((timer) => timer.name).join(", ")}`,
    );
  }

  return parts.join("\n");
};

const LeadingStateIcon = ({ job }: { job: WorkflowTask }) => {
  return <TaskStateIcon className="mr-3 size-6" jobState={job.state} />;
};

export const GateRow = ({
  wait,
}: {
  wait: NonNullable<WorkflowTask["wait"]>;
}) => {
  const statusLabel = getWaitStatusLabel(wait);
  const toneClasses = getWaitRowToneClasses(wait);

  return (
    <div
      className={clsx(
        "flex h-[24px] items-center border-t px-3 text-[11px] leading-4",
        toneClasses.row,
      )}
      data-testid="wait-row"
    >
      <div className="flex items-center gap-1.5">
        <GateRowIcon wait={wait} />
        <span className="truncate">{statusLabel}</span>
      </div>
    </div>
  );
};

const GateRowIcon = ({ wait }: { wait: NonNullable<WorkflowTask["wait"]> }) => {
  if (isWaitBlocking(wait)) {
    return <GateStatusIcon className="size-3.5 shrink-0" />;
  }

  if (wait.phase === "resolved") {
    return <CheckCircleIcon className="size-3.5 shrink-0" />;
  }

  return <GateStatusIcon className="size-3.5 shrink-0" />;
};

const getWaitStatusLabel = (
  wait: NonNullable<WorkflowTask["wait"]>,
): string => {
  switch (wait.phase) {
    case "not_started":
      return "Wait not started";
    case "resolved":
      return "Wait resolved";
    case "waiting":
      return "Wait condition pending";
    default:
      return isWaitBlocking(wait)
        ? "Wait condition pending"
        : "Wait status unknown";
  }
};

const getWaitRowToneClasses = (
  wait: NonNullable<WorkflowTask["wait"]>,
): { row: string } => {
  if (isWaitBlocking(wait)) {
    return {
      row: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200",
    };
  }

  if (wait.phase === "resolved") {
    return {
      row: "border-green-100 bg-green-50/80 text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-100",
    };
  }

  return {
    row: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
  };
};

const isWaitBlocking = (wait: NonNullable<WorkflowTask["wait"]>): boolean => {
  return wait.phase !== "resolved";
};

const getGateHingeClasses = (): string => "";

const getNodeBorderClasses = (state: JobState): string => {
  switch (state) {
    case JobState.Available:
    case JobState.Running:
      return "border-blue-300 dark:border-blue-700";
    case JobState.Cancelled:
    case JobState.Discarded:
      return "border-red-300 dark:border-red-800";
    case JobState.Retryable:
      return "border-amber-300 dark:border-amber-700";
    default:
      return "border-slate-200 dark:border-slate-700";
  }
};

const GateStatusIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1.5 10H5.5L10.5 5M10.5 10H14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <circle cx="5.5" cy="10" fill="currentColor" r="1.25" />
    </svg>
  );
};

const getJobDuration = (job: WorkflowTask): null | ReactElement | string => {
  switch (job.state) {
    case JobState.Available:
      return (
        <DurationMicro
          startTime={job.stagedAt ? job.stagedAt : job.scheduledAt!}
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
      return null;
    case JobState.Retryable:
      return "–";
    case JobState.Running:
      return <DurationMicro startTime={job.attemptedAt!} />;
    case JobState.Scheduled:
      return <DurationMicro endTime={job.scheduledAt!} />;
  }

  return null;
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
