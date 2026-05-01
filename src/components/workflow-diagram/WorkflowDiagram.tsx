import type { WorkflowTask } from "@services/workflows";
import type {
  EdgeTypes,
  Node,
  NodeChange,
  NodeSelectionChange,
  NodeTypes,
} from "@xyflow/react";

import { JobState } from "@services/types";
import { Controls, MiniMap, ReactFlow } from "@xyflow/react";
import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";

import WorkflowDiagramEdge from "./WorkflowDiagramEdge";
import {
  applyEdgeVisuals,
  buildWorkflowGraphModel,
  type WorkflowDependencyStatus,
} from "./workflowDiagramGraphModel";
import WorkflowNode, { type WorkflowNodeData } from "./WorkflowNode";
import "./reactflow-base.css";
import "./workflow-diagram.css";

type WorkflowDiagramProps = {
  selectedJobId?: bigint;
  setSelectedJobId: (id: bigint | undefined) => void;
  tasks: WorkflowTask[];
};

const edgeColors = {
  blocked: "var(--workflow-diagram-edge-muted)",
  failed: "var(--workflow-diagram-edge-failed)",
  unblocked: "var(--workflow-diagram-edge-success)",
} satisfies Record<WorkflowDependencyStatus, string>;

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

const edgeTypes: EdgeTypes = {
  workflowEdge: WorkflowDiagramEdge,
};

const workflowDiagramMinZoom = 0.2;
const workflowDiagramFitViewMaxZoom = 0.85;
const workflowDiagramInitialFitViewMinZoom = 0.6;
const workflowDiagramFitViewPadding = { x: "32px", y: "48px" } as const;
const workflowDiagramInitialFitViewOptions = {
  maxZoom: workflowDiagramFitViewMaxZoom,
  minZoom: workflowDiagramInitialFitViewMinZoom,
  padding: workflowDiagramFitViewPadding,
};
const workflowDiagramOverviewFitViewOptions = {
  maxZoom: workflowDiagramFitViewMaxZoom,
  minZoom: workflowDiagramMinZoom,
  padding: workflowDiagramFitViewPadding,
};

type NodeTypeKey = Extract<keyof typeof nodeTypes, string>;

const getMiniMapNodeClassName = (
  node: Node<WorkflowNodeData, NodeTypeKey>,
): string => {
  const state = node.data?.job?.state;

  switch (state) {
    case JobState.Available:
    case JobState.Running:
      return "fill-blue-300/60 stroke-blue-500/60 dark:fill-blue-700/50 dark:stroke-blue-400/50 stroke-1";
    case JobState.Cancelled:
    case JobState.Discarded:
      return "fill-red-300/60 stroke-red-500/60 dark:fill-red-700/50 dark:stroke-red-400/50 stroke-1";
    case JobState.Completed:
      return "fill-green-300/60 stroke-green-500/60 dark:fill-green-500/70 dark:stroke-green-300/70 stroke-1";
    case JobState.Pending:
    case JobState.Scheduled:
      return "fill-slate-300/60 stroke-slate-600/60 dark:fill-slate-700/50 dark:stroke-slate-400/50 stroke-1";
    case JobState.Retryable:
      return "fill-amber-300/60 stroke-amber-500/60 dark:fill-amber-700/50 dark:stroke-amber-400/50 stroke-1";
    default:
      return "fill-slate-300/60 stroke-slate-600/60 dark:fill-slate-700/50 dark:stroke-slate-400/50 stroke-1";
  }
};

const isNodeSelectionChange = (
  change: NodeChange,
): change is NodeSelectionChange => {
  return change.type === "select";
};

export default function WorkflowDiagram({
  selectedJobId,
  setSelectedJobId,
  tasks,
}: WorkflowDiagramProps) {
  const { resolvedTheme } = useTheme();

  const minimapMaskColor =
    resolvedTheme === "dark" ? "rgb(5, 5, 5, 0.5)" : "rgb(250, 250, 250, 0.5)";

  // Build structural graph data only from `tasks`. This is the expensive stage
  // that includes Dagre layout, so it must not depend on selection or theme.
  const model = useMemo(() => buildWorkflowGraphModel(tasks), [tasks]);

  // Styling is a separate pass from topology/layout so edge visuals can change
  // independently from Dagre node positioning.
  const layoutedEdges = useMemo(
    () => applyEdgeVisuals(model.edges, edgeColors),
    [model.edges],
  );

  // Node selection is UI state layered on top of static layout coordinates.
  // Apply it separately so clicking nodes does not trigger Dagre.
  const layoutedNodes = useMemo(
    () =>
      model.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onSelect: () => {
            setSelectedJobId(
              selectedJobId === node.data.job.id ? undefined : node.data.job.id,
            );
          },
        },
        selected: selectedJobId === node.data.job.id,
      })),
    [model.nodes, selectedJobId, setSelectedJobId],
  );

  // Use workflow id to scope/reset the ReactFlow instance between navigations.
  const workflowIdForInstance = tasks[0]?.workflowID ?? "unknown-workflow";

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const selectionChanges = changes.filter(isNodeSelectionChange);
      if (selectionChanges.length === 0) return;

      const selectedNode = selectionChanges.find((change) => change.selected);

      if (selectedNode && BigInt(selectedNode.id) !== selectedJobId) {
        setSelectedJobId(BigInt(selectedNode.id));
      }
    },
    [selectedJobId, setSelectedJobId],
  );

  return (
    <div className="workflow-diagram-root size-full">
      <ReactFlow
        edges={layoutedEdges}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={workflowDiagramInitialFitViewOptions}
        id={`workflow-diagram-${workflowIdForInstance}`}
        key={`workflow-diagram-${workflowIdForInstance}`}
        minZoom={workflowDiagramMinZoom}
        nodes={layoutedNodes}
        nodesFocusable={true}
        nodeTypes={nodeTypes}
        onEdgesChange={(_newEdges) => {}}
        onNodesChange={onNodesChange}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          className="workflow-diagram-controls"
          fitViewOptions={workflowDiagramOverviewFitViewOptions}
          position="bottom-left"
          showInteractive={false}
        />
        <MiniMap
          className="hidden md:block"
          maskColor={minimapMaskColor}
          nodeClassName={getMiniMapNodeClassName}
          pannable
          style={{
            backgroundColor: resolvedTheme === "dark" ? "#64748b" : "#94a3b8",
            height: 100,
            width: 150,
          }}
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
