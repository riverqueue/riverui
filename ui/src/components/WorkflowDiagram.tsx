import ReactFlow from "reactflow";
import type { Edge, Node, NodeTypes, Position } from "reactflow";
import dagre from "@dagrejs/dagre";

import "reactflow/dist/style.css";

import { JobWithKnownMetadata } from "@services/jobs";
import { useTheme } from "next-themes";
import { JobState } from "@services/types";
import WorkflowNode, { WorkflowNodeData } from "@components/WorkflowNode";

type WorkflowDetailProps = {
  tasks: JobWithKnownMetadata[];
};

type nameToJobMap = {
  [key: string]: JobWithKnownMetadata;
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 250;
const nodeHeight = 180;

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "TB"
): { nodes: Node[]; edges: Edge[] } => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({
    align: "UL",
    edgesep: 100,
    nodesep: 80,
    rankdir: direction,
    ranksep: 80,
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

export default function WorkflowDiagram({ tasks }: WorkflowDetailProps) {
  const { resolvedTheme } = useTheme();

  const edgeColors =
    resolvedTheme === "dark" ? edgeColorsDark : edgeColorsLight;

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

  const initialNodes: Node<WorkflowNodeData, NodeTypeKey>[] = tasks.map(
    (job) => ({
      connectable: false,
      data: {
        hasDownstreamDeps: tasksWithDownstreamDeps[job.metadata.task] || false,
        hasUpstreamDeps: job.metadata.deps?.length > 0,
        job,
      },
      id: job.id.toString(),
      position: { x: 0, y: 0 },
      type: "workflowNode",
    })
  );

  const jobsByTask = tasks.reduce((acc: nameToJobMap, job) => {
    acc[job.metadata.task] = job;
    return acc;
  }, {});

  const initialEdges = tasks.reduce((acc: Edge[], job) => {
    const metadata = job.metadata;
    const newEdges = (metadata.deps || []).map((depName) => {
      const dep = jobsByTask[depName];
      const depStatus = depStatusFromJob(dep);
      const edgeColor = edgeColors[depStatus];

      return {
        animated: depStatus === "blocked",
        id: `e-${dep}-${metadata.task}`,
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

  return (
    <div className="size-full">
      <ReactFlow
        edges={layoutedEdges}
        // fitView
        nodeTypes={nodeTypes}
        nodes={layoutedNodes}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  );
}
