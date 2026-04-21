import type { WorkflowTask, WorkflowTaskWaitReason } from "@services/workflows";
import type { Node, NodeProps } from "@xyflow/react";

import { TaskStateIcon } from "@components/TaskStateIcon";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { JobState } from "@services/types";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import clsx from "clsx";
import { differenceInSeconds } from "date-fns";
import { memo, type ReactElement, useEffect, useMemo, useRef } from "react";
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
    const { hasDownstreamDeps, hasUpstreamDeps, job, onSelect } = data;
    const updateNodeInternals = useUpdateNodeInternals();
    const duration = getJobDuration(job);

    useEffect(() => {
      updateNodeInternals(String(job.id));
    }, [job.id, updateNodeInternals]);

    const tooltip = job.gate ? getGateTooltipText(job.gate) : undefined;

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
        {job.gate ? (
          <CircuitSwitchHandle
            gate={job.gate}
            isConnectable={isConnectable}
            tooltip={tooltip}
            visible={hasUpstreamDeps}
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
// CircuitSwitchHandle — three sibling elements in the node container:
//   1. Left circle div (hinge) — absolute-positioned
//   2. Lever SVG — absolute-positioned between the circles
//   3. Handle div (right circle) — positioned by ReactFlow on the node edge
// All use the same classes as standard handles for pixel-perfect matching.
// ---------------------------------------------------------------------------

const switchHandleClasses = clsx("left-px", handleStyleClasses);

// Distance between circle centers (px).
const switchGap = switchHandleCenterGap;
const switchHandleDiameter = 14;
const switchHandleRadius = switchHandleDiameter / 2;
const switchHandleAnchorLeftOffset = 1;
const gateLeverFlashClosedClass = "workflow-gate-lever--flash-closed";
const gateLeverFlashOpenClass = "workflow-gate-lever--flash-open";

// Open lever angle in degrees (rotated counter-clockwise from horizontal).
const leverAngleDeg = 34;

// Slightly heavier than dependency edges, but not so heavy that it dominates.
const leverStrokeWidth = 2.5;

// SVG viewBox: origin at left circle center, line drawn flat to the right.
// The <g> element is rotated around the origin when the gate is blocking.
const leverVbWidth = switchGap;
const leverVbHeight = leverStrokeWidth + 2;
const leverCy = leverVbHeight / 2;
const leverLineEndX = switchGap - switchHandleRadius + 1;

const CircuitSwitchHandle = ({
  gate,
  isConnectable,
  tooltip,
  visible,
}: {
  gate: NonNullable<WorkflowTask["gate"]>;
  isConnectable: boolean;
  tooltip?: string;
  visible: boolean;
}) => {
  const blocking = isGateBlocking(gate);
  const leftCircleLeft = -(
    switchGap +
    switchHandleRadius -
    switchHandleAnchorLeftOffset
  );

  // Brief color flash when the gate phase changes. Flash tone is derived from
  // gate semantics (blocking vs satisfied), not raw phase labels.
  const leverRef = useRef<SVGSVGElement>(null);
  const prevPhaseRef = useRef(gate.phase);

  useEffect(() => {
    if (prevPhaseRef.current === gate.phase) return;

    prevPhaseRef.current = gate.phase;
    const svg = leverRef.current;
    if (!svg) return;

    const flashClass = getGateFlashClass(gate.phase);
    svg.classList.remove(gateLeverFlashClosedClass, gateLeverFlashOpenClass);
    svg.setAttribute("data-test-workflow-gate-transitioning", "false");
    if (!flashClass) return;

    const animationFrameID = window.requestAnimationFrame(() => {
      svg.classList.add(flashClass);
      svg.setAttribute("data-test-workflow-gate-transitioning", "true");
    });

    const onAnimationEnd = () => {
      svg.classList.remove(gateLeverFlashClosedClass, gateLeverFlashOpenClass);
      svg.setAttribute("data-test-workflow-gate-transitioning", "false");
    };

    svg.addEventListener("animationend", onAnimationEnd);

    return () => {
      window.cancelAnimationFrame(animationFrameID);
      svg.removeEventListener("animationend", onAnimationEnd);
      svg.classList.remove(gateLeverFlashClosedClass, gateLeverFlashOpenClass);
      svg.setAttribute("data-test-workflow-gate-transitioning", "false");
    };
  }, [blocking, gate.phase]);

  return (
    <>
      {/* Lever — rendered first so it layers behind the circles */}
      <svg
        aria-hidden="true"
        className={clsx(
          "workflow-gate-lever absolute",
          getGateLeverPhaseClass(gate.phase),
          !visible && "opacity-0",
        )}
        data-test-workflow-gate-lever={blocking ? "open" : "closed"}
        data-test-workflow-gate-phase={gate.phase}
        data-test-workflow-gate-transitioning="false"
        fill="none"
        ref={leverRef}
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
        <g
          style={{
            transform: blocking
              ? `rotate(-${leverAngleDeg}deg)`
              : "rotate(0deg)",
            transformOrigin: `0px ${leverCy}px`,
            transition: "transform 0.4s ease-in-out",
          }}
        >
          <line
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={leverStrokeWidth}
            x1="0"
            x2={leverLineEndX}
            y1={leverCy}
            y2={leverCy}
          />
        </g>
      </svg>

      {/* Left circle — hinge point */}
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

      {/* Tooltip hover target — spans the full switch area */}
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

const getGateTooltipText = (
  gate: NonNullable<WorkflowTask["gate"]>,
): string => {
  const parts: string[] = [getGateStatusLabel(gate)];

  if (gate.declaredSignals.length > 0) {
    parts.push(`Signals: ${gate.declaredSignals.join(", ")}`);
  }
  if (gate.timers.length > 0) {
    parts.push(`Timers: ${gate.timers.map((t) => t.name).join(", ")}`);
  }

  return parts.join("\n");
};

const LeadingStateIcon = ({ job }: { job: WorkflowTask }) => {
  return <TaskStateIcon className="mr-3 size-6" jobState={job.state} />;
};

export const GateRow = ({
  gate,
}: {
  gate: NonNullable<WorkflowTask["gate"]>;
}) => {
  const statusLabel = getGateStatusLabel(gate);
  const toneClasses = getGateRowToneClasses(gate);

  return (
    <div
      className={clsx(
        "flex h-[24px] items-center border-t px-3 text-[11px] leading-4",
        toneClasses.row,
      )}
      data-testid="gate-row"
    >
      <div className="flex items-center gap-1.5">
        <GateRowIcon gate={gate} />
        <span className="truncate">{statusLabel}</span>
      </div>
    </div>
  );
};

const GateRowIcon = ({ gate }: { gate: NonNullable<WorkflowTask["gate"]> }) => {
  if (isGateBlocking(gate)) {
    return <GateStatusIcon className="size-3.5 shrink-0" />;
  }

  if (gate.phase === "satisfied") {
    return <CheckCircleIcon className="size-3.5 shrink-0" />;
  }

  return <GateStatusIcon className="size-3.5 shrink-0" />;
};

const getGateStatusLabel = (
  gate: NonNullable<WorkflowTask["gate"]>,
): string => {
  switch (gate.phase) {
    case "inactive":
      return "Gate inactive";
    case "satisfied":
      return "Gate satisfied";
    case "waiting":
      return "Gate pending";
    default:
      return isGateBlocking(gate) ? "Gate pending" : "Gate status unknown";
  }
};

const getGateRowToneClasses = (
  gate: NonNullable<WorkflowTask["gate"]>,
): { row: string } => {
  if (isGateBlocking(gate)) {
    return {
      row: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200",
    };
  }

  if (gate.phase === "satisfied") {
    return {
      row: "border-green-100 bg-green-50/80 text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-100",
    };
  }

  return {
    row: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
  };
};

const isGateBlocking = (gate: NonNullable<WorkflowTask["gate"]>): boolean => {
  return gate.phase !== "satisfied";
};

const getGateFlashMode = (
  phase: NonNullable<WorkflowTask["gate"]>["phase"],
): "closed" | "open" | undefined => {
  switch (phase) {
    case "satisfied":
      return "closed";
    case "waiting":
      return "open";
    default:
      return undefined;
  }
};

const getGateFlashClass = (
  phase: NonNullable<WorkflowTask["gate"]>["phase"],
): string | undefined => {
  const flashMode = getGateFlashMode(phase);

  switch (flashMode) {
    case "closed":
      return gateLeverFlashClosedClass;
    case "open":
      return gateLeverFlashOpenClass;
    default:
      return undefined;
  }
};

const getGateLeverPhaseClass = (
  phase: NonNullable<WorkflowTask["gate"]>["phase"],
): string => {
  switch (phase) {
    case "satisfied":
      return "workflow-gate-lever--satisfied";
    case "waiting":
      return "workflow-gate-lever--waiting";
    default:
      return "";
  }
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
