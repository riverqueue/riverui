import type {
  EdgeTypes,
  Node,
  NodeChange,
  NodeSelectionChange,
  NodeTypes,
} from "@xyflow/react";

import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import { MiniMap, ReactFlow } from "@xyflow/react";
import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";

import WorkflowDiagramEdge from "./WorkflowDiagramEdge";
import {
  applyEdgeVisuals,
  buildWorkflowGraphModel,
} from "./workflowDiagramGraphModel";
import WorkflowNode, { type WorkflowNodeData } from "./WorkflowNode";
import "./reactflow-base.css";

type WorkflowDiagramProps = {
  selectedJobId?: bigint;
  setSelectedJobId: (id: bigint | undefined) => void;
  tasks: JobWithKnownMetadata[];
};

const edgeColorsLight = {
  blocked: "#cbd5e1",
  failed: "#dc2626",
  unblocked: "#cbd5e1",
};

const edgeColorsDark = {
  blocked: "#475569",
  failed: "#dc2626",
  unblocked: "#475569",
};

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

const edgeTypes: EdgeTypes = {
  workflowEdge: WorkflowDiagramEdge,
};

type NodeTypeKey = Extract<keyof typeof nodeTypes, string>;

const getMiniMapNodeClassName = (
  node: Node<WorkflowNodeData, NodeTypeKey>,
): string => {
  const state = node.data?.job?.state;

  switch (state) {
    case JobState.Available:
    case JobState.Pending:
    case JobState.Retryable:
    case JobState.Scheduled:
      return "fill-amber-300/60 stroke-amber-500/60 dark:fill-amber-700/50 dark:stroke-amber-400/50 stroke-1";
    case JobState.Cancelled:
    case JobState.Discarded:
      return "fill-red-300/60 stroke-red-500/60 dark:fill-red-700/50 dark:stroke-red-400/50 stroke-1";
    case JobState.Completed:
      return "fill-green-300/60 stroke-green-500/60 dark:fill-green-500/70 dark:stroke-green-300/70 stroke-1";
    case JobState.Running:
      return "fill-blue-300/60 stroke-blue-500/60 dark:fill-blue-700/50 dark:stroke-blue-400/50 stroke-1";
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

  const edgeColors =
    resolvedTheme === "dark" ? edgeColorsDark : edgeColorsLight;

  const minimapMaskColor =
    resolvedTheme === "dark" ? "rgb(5, 5, 5, 0.5)" : "rgb(250, 250, 250, 0.5)";

  // Build structural graph data only from `tasks`. This is the expensive stage
  // that includes Dagre layout, so it must not depend on selection or theme.
  const model = useMemo(() => buildWorkflowGraphModel(tasks), [tasks]);

  // Theme updates should only restyle existing edges, not recompute topology or
  // layout. Keeping this in a separate memo avoids unnecessary layout work.
  const layoutedEdges = useMemo(
    () => applyEdgeVisuals(model.edges, edgeColors),
    [edgeColors, model.edges],
  );

  // Node selection is UI state layered on top of static layout coordinates.
  // Apply it separately so clicking nodes does not trigger Dagre.
  const layoutedNodes = useMemo(
    () =>
      model.nodes.map((node) => ({
        ...node,
        selected: selectedJobId === node.data.job.id,
      })),
    [model.nodes, selectedJobId],
  );

  // Use workflow id to scope/reset the ReactFlow instance between navigations.
  const workflowIdForInstance =
    tasks[0]?.metadata.workflow_id ?? "unknown-workflow";

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
    <div className="size-full">
      <ReactFlow
        defaultViewport={{ x: 32, y: 32, zoom: 1 }}
        edges={layoutedEdges}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        id={`workflow-diagram-${workflowIdForInstance}`}
        key={`workflow-diagram-${workflowIdForInstance}`}
        minZoom={0.8}
        nodes={layoutedNodes}
        nodesFocusable={true}
        nodeTypes={nodeTypes}
        onEdgesChange={(_newEdges) => {}}
        onNodesChange={onNodesChange}
        proOptions={{ hideAttribution: true }}
      >
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
