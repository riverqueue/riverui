import type { Meta, StoryObj } from "@storybook/react-vite";

import clsx from "clsx";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Dimensions match the production gate handle so each tile renders at true
// scale: two 14px circles, 36px center-to-center. See
// workflowDiagramConstants.ts / WorkflowNode.tsx for the source of truth.
// ---------------------------------------------------------------------------

const CIRCLE_DIAMETER = 14;
const CIRCLE_RADIUS = CIRCLE_DIAMETER / 2;
const CENTER_GAP = 36;
const BOX_WIDTH = CENTER_GAP + CIRCLE_DIAMETER;
const BOX_HEIGHT = CIRCLE_DIAMETER;
const LINE_Y = CIRCLE_RADIUS;
const LINE_START_X = CIRCLE_RADIUS;
const LINE_END_X = CENTER_GAP - CIRCLE_RADIUS + 1;
const MID_X = CENTER_GAP / 2;
const STROKE = 2;

const handleClass = clsx(
  "size-3.5 rounded-full border-2 border-slate-300 bg-slate-50",
  "dark:border-slate-600 dark:bg-slate-800",
);

// SVG viewBox origin at the left circle's center so variants can anchor to
// it (e.g. the circuit-switch lever hinge).
const viewBox = `-${CIRCLE_RADIUS} 0 ${BOX_WIDTH} ${BOX_HEIGHT}`;

type GateProps = { blocking: boolean };

const GateCanvas = ({ children }: { children: ReactNode }) => (
  <div className="relative" style={{ height: BOX_HEIGHT, width: BOX_WIDTH }}>
    <span
      aria-hidden
      className={clsx(handleClass, "absolute left-0 top-0 z-10")}
    />
    <svg
      className="absolute inset-0"
      height={BOX_HEIGHT}
      style={{ overflow: "visible" }}
      viewBox={viewBox}
      width={BOX_WIDTH}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
    <span
      aria-hidden
      className={clsx(handleClass, "absolute right-0 top-0 z-10")}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Variant 1: circuit switch (current production design). Lever pivots around
// the left circle's center; -34° when blocking, 0° when resolved.
// ---------------------------------------------------------------------------

const CircuitSwitchGate = ({ blocking }: GateProps) => (
  <g
    style={{
      transform: blocking ? "rotate(-34deg)" : "rotate(0deg)",
      transformOrigin: `0px ${LINE_Y}px`,
      transition: "transform 0.4s ease-in-out",
    }}
  >
    <line
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={STROKE}
      x1={0}
      x2={LINE_END_X}
      y1={LINE_Y}
      y2={LINE_Y}
    />
  </g>
);

// ---------------------------------------------------------------------------
// Variant 2: line that terminates in an X at ~45% across the gap while
// blocking, then extends out to the right circle when resolved. Line reveal
// is animated with stroke-dashoffset so the tip tracks the X position.
// ---------------------------------------------------------------------------

const LineWithXGate = ({ blocking }: GateProps) => {
  const xCx = LINE_START_X + (LINE_END_X - LINE_START_X) * 0.45;
  const xSize = 3.5;
  const xStroke = 1.75;
  const pathLength = LINE_END_X - LINE_START_X;
  const blockingHiddenLength = LINE_END_X - xCx;
  return (
    <>
      <line
        stroke="currentColor"
        strokeDasharray={`${pathLength} ${pathLength}`}
        strokeLinecap="round"
        strokeWidth={STROKE}
        style={{
          strokeDashoffset: blocking ? blockingHiddenLength : 0,
          transition: "stroke-dashoffset 0.35s ease-in-out",
        }}
        x1={LINE_START_X}
        x2={LINE_END_X}
        y1={LINE_Y}
        y2={LINE_Y}
      />
      <g
        className="text-amber-500/80 dark:text-amber-400/60"
        style={{
          opacity: blocking ? 1 : 0,
          transform: blocking ? "scale(1)" : "scale(0.2)",
          transformOrigin: `${xCx}px ${LINE_Y}px`,
          transition:
            "opacity 0.25s ease-in-out, transform 0.25s ease-in-out",
        }}
      >
        <line
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={xStroke}
          x1={xCx - xSize}
          x2={xCx + xSize}
          y1={LINE_Y - xSize}
          y2={LINE_Y + xSize}
        />
        <line
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={xStroke}
          x1={xCx - xSize}
          x2={xCx + xSize}
          y1={LINE_Y + xSize}
          y2={LINE_Y - xSize}
        />
      </g>
    </>
  );
};

// ---------------------------------------------------------------------------
// Variant 2b: line that terminates at a capacitor-style marker (two short
// parallel vertical lines) while blocking. Shares the stroke-dashoffset
// reveal with the X variant; marker fades + scales away on resolve.
// ---------------------------------------------------------------------------

const LineWithCapacitorGate = ({ blocking }: GateProps) => {
  const capCx = LINE_START_X + (LINE_END_X - LINE_START_X) * 0.45;
  const capHalfHeight = 4;
  const capGap = 1.5;
  const capStroke = 1.75;
  const pathLength = LINE_END_X - LINE_START_X;
  const blockingHiddenLength = LINE_END_X - (capCx - capGap);
  return (
    <>
      <line
        stroke="currentColor"
        strokeDasharray={`${pathLength} ${pathLength}`}
        strokeLinecap="round"
        strokeWidth={STROKE}
        style={{
          strokeDashoffset: blocking ? blockingHiddenLength : 0,
          transition: "stroke-dashoffset 0.35s ease-in-out",
        }}
        x1={LINE_START_X}
        x2={LINE_END_X}
        y1={LINE_Y}
        y2={LINE_Y}
      />
      <g
        className="text-amber-500/80 dark:text-amber-400/60"
        style={{
          opacity: blocking ? 1 : 0,
          transform: blocking ? "scale(1)" : "scale(0.2)",
          transformOrigin: `${capCx}px ${LINE_Y}px`,
          transition:
            "opacity 0.25s ease-in-out, transform 0.25s ease-in-out",
        }}
      >
        <line
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={capStroke}
          x1={capCx - capGap}
          x2={capCx - capGap}
          y1={LINE_Y - capHalfHeight}
          y2={LINE_Y + capHalfHeight}
        />
        <line
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={capStroke}
          x1={capCx + capGap}
          x2={capCx + capGap}
          y1={LINE_Y - capHalfHeight}
          y2={LINE_Y + capHalfHeight}
        />
      </g>
    </>
  );
};

// ---------------------------------------------------------------------------
// Variant 2c: line that terminates at a single short vertical bar while
// blocking. Minimal cousin of the capacitor variant — same reveal + fade.
// ---------------------------------------------------------------------------

const LineWithBarGate = ({ blocking }: GateProps) => {
  const barCx = LINE_START_X + (LINE_END_X - LINE_START_X) * 0.45;
  const barHalfHeight = 6;
  const barStroke = 1.75;
  const pathLength = LINE_END_X - LINE_START_X;
  const blockingHiddenLength = LINE_END_X - barCx;
  return (
    <>
      <line
        stroke="currentColor"
        strokeDasharray={`${pathLength} ${pathLength}`}
        strokeLinecap="round"
        strokeWidth={STROKE}
        style={{
          strokeDashoffset: blocking ? blockingHiddenLength : 0,
          transition: "stroke-dashoffset 0.35s ease-in-out",
        }}
        x1={LINE_START_X}
        x2={LINE_END_X}
        y1={LINE_Y}
        y2={LINE_Y}
      />
      <g
        className="text-amber-500/80 dark:text-amber-400/60"
        style={{
          opacity: blocking ? 1 : 0,
          transform: blocking ? "scale(1)" : "scale(0.2)",
          transformOrigin: `${barCx}px ${LINE_Y}px`,
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
          y1={LINE_Y - barHalfHeight}
          y2={LINE_Y + barHalfHeight}
        />
      </g>
    </>
  );
};

// ---------------------------------------------------------------------------
// Variant 3: drop-gate arm pivoting 90° about the midpoint of the gap. The
// arm *is* the line: horizontal when resolved (through-line), rotates
// clockwise to vertical when blocking (barrier across the gap).
// ---------------------------------------------------------------------------

const BarrierGate = ({ blocking }: GateProps) => (
  <line
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth={STROKE}
    style={{
      transform: blocking ? "rotate(-90deg)" : "rotate(0deg)",
      transformOrigin: `${MID_X}px ${LINE_Y}px`,
      transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
    }}
    x1={LINE_START_X}
    x2={LINE_END_X}
    y1={LINE_Y}
    y2={LINE_Y}
  />
);

// ---------------------------------------------------------------------------
// Variant 4: iris — a solid disk plugs the gap when blocking; collapses to
// zero and the line fills in underneath when resolved.
// ---------------------------------------------------------------------------

const IrisGate = ({ blocking }: GateProps) => (
  <>
    <line
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={STROKE}
      style={{
        opacity: blocking ? 0 : 1,
        transition: "opacity 0.3s ease-in-out 0.15s",
      }}
      x1={LINE_START_X}
      x2={LINE_END_X}
      y1={LINE_Y}
      y2={LINE_Y}
    />
    <circle
      cx={MID_X}
      cy={LINE_Y}
      fill="currentColor"
      r={5}
      style={{
        transform: blocking ? "scale(1)" : "scale(0)",
        transformBox: "fill-box",
        transformOrigin: "center",
        transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    />
  </>
);

// ---------------------------------------------------------------------------
// Variant 5: dashed marching-ants flow. While blocking the line is dashed and
// the dashes march toward a blocker dot; when resolved the dot retracts and
// the line becomes solid.
// ---------------------------------------------------------------------------

const DashedFlowGate = ({ blocking }: GateProps) => (
  <>
    <line
      className={blocking ? "gate-gallery-march" : undefined}
      stroke="currentColor"
      strokeDasharray={blocking ? "3 3" : undefined}
      strokeLinecap="round"
      strokeWidth={STROKE}
      x1={LINE_START_X}
      x2={LINE_END_X}
      y1={LINE_Y}
      y2={LINE_Y}
    />
    <circle
      cx={LINE_START_X + (LINE_END_X - LINE_START_X) * 0.65}
      cy={LINE_Y}
      fill="currentColor"
      r={2.25}
      style={{
        transform: blocking ? "scale(1)" : "scale(0)",
        transformBox: "fill-box",
        transformOrigin: "center",
        transition: "transform 0.25s ease-in-out",
      }}
    />
  </>
);

// ---------------------------------------------------------------------------
// Variant registry
// ---------------------------------------------------------------------------

type Variant = {
  body: ComponentType<GateProps>;
  caption: string;
  current?: boolean;
  label: string;
};

const variants: Variant[] = [
  {
    body: CircuitSwitchGate,
    caption:
      "Lever pivots at the left hinge. Rotates −34° when blocking, back to horizontal when resolved.",
    current: true,
    label: "Circuit switch",
  },
  {
    body: LineWithXGate,
    caption:
      "Line runs the full gap but dims while blocking, with an X crossed over it at ~45% across.",
    label: "Line with X",
  },
  {
    body: LineWithCapacitorGate,
    caption:
      "Line terminates at a capacitor-style marker — two short parallel verticals — while blocking.",
    label: "Line with capacitor",
  },
  {
    body: LineWithBarGate,
    caption:
      "Line terminates at a single short vertical bar while blocking.",
    label: "Line with bar",
  },
  {
    body: BarrierGate,
    caption:
      "Arm pivots about the center of the gap: horizontal to pass, rotates clockwise 90° to block.",
    label: "Drop-gate barrier",
  },
  {
    body: IrisGate,
    caption:
      "Solid disk plugs the gap. Collapses to zero when resolved, revealing the line.",
    label: "Iris",
  },
  {
    body: DashedFlowGate,
    caption:
      "Dashes march toward a blocker dot while blocking; collapse to a solid line when resolved.",
    label: "Dashed flow",
  },
];

// ---------------------------------------------------------------------------
// Tile + gallery
// ---------------------------------------------------------------------------

const GALLERY_STYLE = `
@keyframes gate-gallery-march {
  to { stroke-dashoffset: -6; }
}
.gate-gallery-march {
  animation: gate-gallery-march 0.6s linear infinite;
}
`;

const GateTile = ({
  blocking,
  variant,
}: {
  blocking: boolean;
  variant: Variant;
}) => {
  const Body = variant.body;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {variant.label}
          </div>
          {variant.current ? (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Current
            </span>
          ) : null}
        </div>
        <span
          className={clsx(
            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors duration-300",
            blocking
              ? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
          )}
        >
          {blocking ? "Waiting" : "Resolved"}
        </span>
      </div>
      <div className="my-8 flex justify-center text-slate-300 dark:text-slate-600">
        <GateCanvas>
          <Body blocking={blocking} />
        </GateCanvas>
      </div>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {variant.caption}
      </p>
    </div>
  );
};

const TOGGLE_MS = 4000;

const GalleryRender = () => {
  const [blocking, setBlocking] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => {
      setBlocking((prev) => !prev);
    }, TOGGLE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-8 dark:bg-slate-900">
      <style>{GALLERY_STYLE}</style>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Wait-gate design gallery
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Side-by-side alternatives for the wait-transition visual. All
              tiles share a timer that toggles every {TOGGLE_MS / 1000}s.
              Gate lines use the same tone and weight as dependency edges so
              the motion is evaluated against production styling.
            </p>
          </div>
          <button
            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => setBlocking((prev) => !prev)}
            type="button"
          >
            Toggle now
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {variants.map((variant) => (
            <GateTile
              blocking={blocking}
              key={variant.label}
              variant={variant}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const meta: Meta = {
  parameters: { layout: "fullscreen" },
  title: "Components/WorkflowDiagram/Gate Gallery",
};

export default meta;

type Story = StoryObj;

export const Gallery: Story = {
  render: () => <GalleryRender />,
};
