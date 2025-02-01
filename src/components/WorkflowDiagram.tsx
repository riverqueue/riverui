import { ReactFlow, MiniMap } from "@xyflow/react";
import type {
  Edge,
  Node,
  NodeChange,
  NodeSelectionChange,
  NodeTypes,
  Position,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";

import "@xyflow/react/dist/style.css";

import { JobWithKnownMetadata } from "@services/jobs";
import { useTheme } from "next-themes";
import { JobState } from "@services/types";
import WorkflowNode, { WorkflowNodeData } from "@components/WorkflowNode";
import { useCallback, useMemo } from "react";

type WorkflowDiagramProps = {
  selectedJobId?: bigint;
  setSelectedJobId: (id: bigint | undefined) => void;
  tasks: JobWithKnownMetadata[];
};

type nameToJobMap = {
  [key: string]: JobWithKnownMetadata;
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 256;
const nodeHeight = 44;

const getLayoutedElements = (
  nodes: Node<WorkflowNodeData, NodeTypeKey>[],
  edges: Edge[],
  direction = "TB"
): { nodes: Node<WorkflowNodeData, NodeTypeKey>[]; edges: Edge[] } => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({
    align: "UL",
    edgesep: 100,
    nodesep: 20,
    rankdir: direction,
    ranksep: 100,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = (isHorizontal ? "left" : "top") as Position;
    node.sourcePosition = (isHorizontal ? "right" : "bottom") as Position;

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

const edgeColorsLight = {
  blocked: "#cbd5e1",
  unblocked: "#cbd5e1",
  failed: "#dc2626",
};
const edgeColorsDark = {
  blocked: "#475569",
  unblocked: "#475569",
  failed: "#dc2626",
};

const depStatusFromJob = (job: JobWithKnownMetadata) => {
  switch (job.state) {
    case JobState.Completed:
      return "unblocked";
    case (JobState.Cancelled, JobState.Discarded):
      return "failed";
    default:
      return "blocked";
  }
};

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
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
    {}
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
        id: job.id.toString(),
        position: { x: 0, y: 0 },
        selected: selectedJobId === job.id,
        type: "workflowNode",
      })),
    [tasks, selectedJobId, tasksWithDownstreamDeps]
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

        return {
          animated: depStatus === "blocked",
          id: `e-${dep.id}-${job.id}`,
          source: dep.id.toString(),
          style: {
            strokeWidth: 2,
            stroke: edgeColor,
          },
          target: job.id.toString(),
          type: "smoothstep",
        };
      });
    return [...acc, ...newEdges];
  }, []);

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    initialNodes,
    initialEdges,
    "LR"
  );

  const isNodeSelectionChange = (
    change: NodeChange
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
    [selectedJobId, setSelectedJobId]
  );

  return (
    <div className="size-full">
      <ReactFlow
        defaultViewport={{ x: 32, y: 32, zoom: 1 }}
        edges={layoutedEdges}
        // fitView
        nodesFocusable={true}
        nodeTypes={nodeTypes}
        nodes={layoutedNodes}
        onEdgesChange={(_newEdges) => {}}
        onNodesChange={onNodesChange}
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          className="hidden bg-slate-400 dark:bg-slate-500 md:block"
          maskColor={minimapMaskColor}
          // TODO: dynamic class name based on state
          nodeClassName="fill-slate-500 dark:fill-slate-800"
          pannable
          style={{ height: 100, width: 150 }}
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
