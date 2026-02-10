import type { Edge, Node } from "@xyflow/react";

const nodeHeight = 44;
const sameRowTolerance = 1;
const targetMergePadding = 20;

const nodeCenterY = (node: Node): number => {
  const renderedHeight = node.height ?? node.measured?.height ?? nodeHeight;
  return node.position.y + renderedHeight / 2;
};

export const withPreferredTargetMergeX = (
  edges: Edge[],
  nodes: Node[],
): Edge[] => {
  const nodeByID = new Map<string, Node>(nodes.map((node) => [node.id, node]));
  const incomingByTarget = new Map<string, Edge[]>();

  edges.forEach((edge) => {
    const incomingEdges = incomingByTarget.get(edge.target);
    if (incomingEdges) {
      incomingEdges.push(edge);
      return;
    }

    incomingByTarget.set(edge.target, [edge]);
  });

  const preferredBendByEdgeID = new Map<string, number>();

  incomingByTarget.forEach((incomingEdges, targetID) => {
    if (incomingEdges.length < 2) return;

    const targetNode = nodeByID.get(targetID);
    if (!targetNode) return;

    const targetCenterY = nodeCenterY(targetNode);
    const offRowEdges: Edge[] = [];
    let hasSameRowIncoming = false;

    incomingEdges.forEach((edge) => {
      const sourceNode = nodeByID.get(edge.source);
      if (!sourceNode) return;

      const sourceCenterY = nodeCenterY(sourceNode);
      if (Math.abs(sourceCenterY - targetCenterY) <= sameRowTolerance) {
        hasSameRowIncoming = true;
        return;
      }

      offRowEdges.push(edge);
    });

    if (!hasSameRowIncoming || offRowEdges.length === 0) return;

    const preferredBendX = targetNode.position.x - targetMergePadding;
    offRowEdges.forEach((edge) => {
      preferredBendByEdgeID.set(edge.id, preferredBendX);
    });
  });

  if (preferredBendByEdgeID.size === 0) return edges;

  return edges.map((edge) => {
    const preferredBendX = preferredBendByEdgeID.get(edge.id);
    if (preferredBendX === undefined) return edge;

    return {
      ...edge,
      data: {
        ...((edge.data as Record<string, unknown> | undefined) || {}),
        preferredBendX,
      },
    };
  });
};
