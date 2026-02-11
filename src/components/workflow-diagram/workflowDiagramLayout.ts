import type { Edge, Node, Position } from "@xyflow/react";

import dagre from "@dagrejs/dagre";

import type { Point, Rect } from "./workflowDiagramGeometry";
import type { WorkflowNodeData } from "./WorkflowNode";

import { nodeHeight, nodeWidth } from "./workflowDiagramConstants";

export type WorkflowDiagramNodeType = "workflowNode";

export const getLayoutedElements = (
  nodes: Node<WorkflowNodeData, WorkflowDiagramNodeType>[],
  edges: Edge[],
  direction = "TB",
): {
  edges: Edge[];
  nodes: Node<WorkflowNodeData, WorkflowDiagramNodeType>[];
} => {
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
      // Dagre positions nodes by center; React Flow expects top-left coordinates.
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      sourcePosition: (isHorizontal ? "right" : "bottom") as Position,
      targetPosition: (isHorizontal ? "left" : "top") as Position,
    };
  });

  // Each edge reads from the same snapshot of node rectangles so collision
  // checks are consistent regardless of render order.
  const nodeRects: Rect[] = layoutedNodes.map((node) => ({
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

    const dagrePoints: Point[] = (edgeWithPoints?.points || []).map(
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
