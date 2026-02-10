import type {
  Edge,
  EdgeTypes,
  Node,
  NodeChange,
  NodeSelectionChange,
  NodeTypes,
  Position,
} from "@xyflow/react";

import WorkflowNode, { WorkflowNodeData } from "@components/WorkflowNode";

import "./reactflow-base.css";
import dagre from "@dagrejs/dagre";
import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import { MiniMap, ReactFlow } from "@xyflow/react";
import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";

import type { WorkflowDiagramNodeRect } from "./workflowDiagramEdgePath";

import WorkflowDiagramEdge from "./WorkflowDiagramEdge";
import { withPreferredTargetMergeX } from "./workflowDiagramMergeHints";

type nameToJobMap = {
  [key: string]: JobWithKnownMetadata;
};

type WorkflowDiagramProps = {
  selectedJobId?: bigint;
  setSelectedJobId: (id: bigint | undefined) => void;
  tasks: JobWithKnownMetadata[];
};

const nodeWidth = 256;
const nodeHeight = 44;

const getLayoutedElements = (
  nodes: Node<WorkflowNodeData, NodeTypeKey>[],
  edges: Edge[],
  direction = "TB",
): { edges: Edge[]; nodes: Node<WorkflowNodeData, NodeTypeKey>[] } => {
  const dagreGraph = new dagre.graphlib.Graph({ multigraph: true });
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({
    align: "UL",
    edgesep: 100,
    nodesep: 20,
    rankdir: direction,
    ranksep: 100,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { height: nodeHeight, width: nodeWidth });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target, {}, edge.id);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      // Shift dagre center-based coordinates to React Flow's top-left anchor.
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      sourcePosition: (isHorizontal ? "right" : "bottom") as Position,
      targetPosition: (isHorizontal ? "left" : "top") as Position,
    };
  });

  const nodeRects: WorkflowDiagramNodeRect[] = layoutedNodes.map((node) => ({
    height: node.height ?? node.measured?.height ?? nodeHeight,
    width: node.width ?? node.measured?.width ?? nodeWidth,
    x: node.position.x,
    y: node.position.y,
  }));

  const layoutedEdges = edges.map((edge) => {
    const edgeWithPoints = dagreGraph.edge({
      name: edge.id,
      v: edge.source,
      w: edge.target,
    });
    const dagrePoints = (edgeWithPoints?.points || []).map(
      (point: { x: number; y: number }) => ({
        x: point.x,
        y: point.y,
      }),
    );

    return {
      ...edge,
      data: {
        ...(edge.data as Record<string, unknown> | undefined),
        dagrePoints,
        nodeRects,
      },
    };
  });

  return { edges: layoutedEdges, nodes: layoutedNodes };
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

const depStatusFromJob = (job: JobWithKnownMetadata) => {
  switch (job.state) {
    case JobState.Cancelled:
    case JobState.Discarded:
      return "failed";
    case JobState.Completed:
      return "unblocked";
    default:
      return "blocked";
  }
};

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};
const edgeTypes: EdgeTypes = {
  workflowEdge: WorkflowDiagramEdge,
};

type NodeTypeKey = Extract<keyof typeof nodeTypes, string>;

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

  // TODO: not ideal to iterate through this list so many times. Should probably
  // do that once and save all results at the same time.

  const tasksWithDownstreamDeps = tasks.reduce(
    (acc: Record<string, boolean>, job) => {
      const deps = job.metadata.deps || [];
      deps.forEach((depName) => {
        acc[depName] = true;
      });
      return acc;
    },
    {},
  );

  const initialNodes: Node<WorkflowNodeData, NodeTypeKey>[] = useMemo(
    () =>
      tasks.map((job) => ({
        connectable: false,
        data: {
          hasDownstreamDeps:
            tasksWithDownstreamDeps[job.metadata.task] || false,
          hasUpstreamDeps: job.metadata.deps?.length > 0,
          job,
        },
        height: nodeHeight,
        id: job.id.toString(),
        position: { x: 0, y: 0 },
        selected: selectedJobId === job.id,
        type: "workflowNode",
        width: nodeWidth,
      })),
    [tasks, selectedJobId, tasksWithDownstreamDeps],
  );

  const jobsByTask = tasks.reduce((acc: nameToJobMap, job) => {
    acc[job.metadata.task] = job;
    return acc;
  }, {});

  const initialEdges = tasks.reduce((acc: Edge[], job) => {
    const metadata = job.metadata;
    const newEdges = (metadata.deps || [])
      // Filter out any deps that aren't in the list of jobs (maybe due to being
      // deleted or cleaned already):
      .filter((dep) => jobsByTask[dep])
      .map((depName) => {
        const dep = jobsByTask[depName];
        const depStatus = depStatusFromJob(dep);
        const edgeColor = edgeColors[depStatus];

        // Only animate when the downstream job is actively waiting on deps
        // i.e., Pending. If the downstream job is cancelled/discarded/etc.,
        // keep the edge static.
        const isActivelyWaiting = job.state === JobState.Pending;

        // Subtle visual distinction:
        // - blocked: grey dashed; animated only if actively waiting
        // - failed: red dashed; never animated
        // - unblocked: grey solid
        const strokeDasharray = depStatus === "unblocked" ? "0" : "6 3";

        return {
          animated: depStatus === "blocked" && isActivelyWaiting,
          id: `e-${dep.id}-${job.id}`,
          source: dep.id.toString(),
          style: {
            stroke: edgeColor,
            strokeDasharray,
            strokeWidth: 2,
          },
          target: job.id.toString(),
          type: "workflowEdge",
        };
      });
    return [...acc, ...newEdges];
  }, []);

  const { edges: layoutedEdgesRaw, nodes: layoutedNodes } = getLayoutedElements(
    initialNodes,
    initialEdges,
    "LR",
  );
  const layoutedEdges = withPreferredTargetMergeX(
    layoutedEdgesRaw,
    layoutedNodes,
  );

  // Use workflow id to scope/reset the ReactFlow instance between navigations
  const workflowIdForInstance =
    tasks[0]?.metadata.workflow_id ?? "unknown-workflow";

  const isNodeSelectionChange = (
    change: NodeChange,
  ): change is NodeSelectionChange => {
    return change.type === "select";
  };

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const selectionChanges = changes.filter(isNodeSelectionChange);
      if (selectionChanges.length === 0) return;

      const selectedNode = selectionChanges.find((change) => change.selected);

      // If there's a new selected node, set that and we're done:
      if (selectedNode && BigInt(selectedNode.id) !== selectedJobId) {
        setSelectedJobId(BigInt(selectedNode.id));
        return;
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
