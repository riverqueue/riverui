import type { EdgeProps } from "@xyflow/react";

import { BaseEdge } from "@xyflow/react";

import {
  buildWorkflowDiagramEdgePath,
  type WorkflowDiagramNodeRect,
} from "./workflowDiagramEdgePath";

export type WorkflowDiagramEdgeData = {
  dagrePoints?: Array<{ x: number; y: number }>;
  depStatus?: "blocked" | "failed" | "unblocked";
  nodeRects?: WorkflowDiagramNodeRect[];
  preferredBendX?: number;
  targetAnchorOffsetX?: number;
};

export type WorkflowDiagramEdgeProps = Pick<
  EdgeProps,
  "data" | "markerEnd" | "sourceX" | "sourceY" | "style" | "targetX" | "targetY"
>;

export default function WorkflowDiagramEdge({
  data,
  markerEnd,
  sourceX,
  sourceY,
  style,
  targetX,
  targetY,
}: WorkflowDiagramEdgeProps) {
  const edgeData = data as undefined | WorkflowDiagramEdgeData;

  const path = buildWorkflowDiagramEdgePath({
    dagrePoints: edgeData?.dagrePoints,
    nodeRects: edgeData?.nodeRects,
    preferredBendX: edgeData?.preferredBendX,
    sourceX,
    sourceY,
    targetX: targetX + (edgeData?.targetAnchorOffsetX ?? 0),
    targetY,
  });

  return <BaseEdge markerEnd={markerEnd} path={path} style={style} />;
}
