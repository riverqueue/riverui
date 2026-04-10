import type { Edge, Node } from "@xyflow/react";

import { JobState } from "@services/types";
import { type WorkflowTask } from "@services/workflows";

import type { WorkflowNodeData } from "./WorkflowNode";

import {
  nodeHeight,
  nodeWidth,
  switchHandleCenterGap,
} from "./workflowDiagramConstants";
import {
  getLayoutedElements,
  type WorkflowDiagramNodeType,
} from "./workflowDiagramLayout";
import { withPreferredTargetMergeX } from "./workflowDiagramMergeHints";

export type WorkflowDependencyStatus = "blocked" | "failed" | "unblocked";

export type WorkflowGraphModel = {
  edges: Edge[];
  nodes: Node<WorkflowNodeData, WorkflowDiagramNodeType>[];
};

const withTargetAnchorOffsets = (
  edges: Edge[],
  nodes: Node<WorkflowNodeData, WorkflowDiagramNodeType>[],
): Edge[] => {
  const nodeByID = new Map(nodes.map((node) => [node.id, node]));

  return edges.map((edge) => {
    const targetNode = nodeByID.get(edge.target);
    if (!targetNode?.data.job.gate) return edge;

    return {
      ...edge,
      data: {
        ...((edge.data as Record<string, unknown> | undefined) || {}),
        targetAnchorOffsetX: -switchHandleCenterGap,
      },
    };
  });
};

const depStatusFromEdgeData = (
  edgeData: unknown,
): undefined | WorkflowDependencyStatus => {
  if (!edgeData || typeof edgeData !== "object") return undefined;

  const depStatus = (edgeData as { depStatus?: unknown }).depStatus;
  if (
    depStatus === "blocked" ||
    depStatus === "failed" ||
    depStatus === "unblocked"
  ) {
    return depStatus;
  }

  return undefined;
};

export const depStatusFromJob = (
  job: WorkflowTask,
): WorkflowDependencyStatus => {
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

export const buildWorkflowGraphModel = (
  tasks: WorkflowTask[],
  opts?: { forceNodeHeight?: number },
): WorkflowGraphModel => {
  const jobsByTask = new Map<string, WorkflowTask>();
  const tasksWithDownstreamDeps = new Set<string>();

  // Build dependency lookup structures in one pass so large workflows do not
  // pay for repeated scans when building nodes and edges.
  tasks.forEach((job) => {
    jobsByTask.set(job.name, job);

    (job.deps ?? []).forEach((depTaskName) => {
      tasksWithDownstreamDeps.add(depTaskName);
    });
  });

  const initialNodes: Node<WorkflowNodeData, WorkflowDiagramNodeType>[] =
    tasks.map((job) => {
      // Defensively handle malformed test data with a missing deps array.
      const deps = job.deps ?? [];

      return {
        connectable: false,
        data: {
          hasDownstreamDeps: tasksWithDownstreamDeps.has(job.name),
          hasUpstreamDeps: deps.length > 0,
          job,
          waitReason: job.waitReason,
        },
        height: opts?.forceNodeHeight ?? nodeHeight,
        id: job.id.toString(),
        position: { x: 0, y: 0 },
        type: "workflowNode",
        width: nodeWidth,
      };
    });

  const initialEdges = tasks.reduce<Edge[]>((acc, job) => {
    const dependencies = job.deps ?? [];

    dependencies.forEach((depName) => {
      const dep = jobsByTask.get(depName);

      // Keep existing behavior: ignore references to tasks that are no longer
      // in the current payload.
      if (!dep) return;

      const depStatus = depStatusFromJob(dep);
      // Animate only when the downstream job is currently waiting for upstream
      // dependencies. This keeps cancelled/discarded downstream jobs visually
      // static even if their upstream dependency is still blocked.
      const isActivelyWaiting = job.waitReason !== "none";

      acc.push({
        animated: depStatus === "blocked" && isActivelyWaiting,
        data: { depStatus },
        id: `e-${dep.id}-${job.id}`,
        source: dep.id.toString(),
        target: job.id.toString(),
        type: "workflowEdge",
      });
    });

    return acc;
  }, []);

  const { edges: layoutedEdgesRaw, nodes: layoutedNodes } = getLayoutedElements(
    initialNodes,
    initialEdges,
    "LR",
  );
  const hintedEdges = withPreferredTargetMergeX(
    layoutedEdgesRaw,
    layoutedNodes,
  );

  return {
    edges: withTargetAnchorOffsets(hintedEdges, layoutedNodes),
    nodes: layoutedNodes,
  };
};

export const applyEdgeVisuals = (
  edges: Edge[],
  edgeColors: Record<WorkflowDependencyStatus, string>,
): Edge[] => {
  // Styling is intentionally split from graph building so theme changes only
  // trigger this cheap map instead of a full Dagre layout pass.
  return edges.map((edge) => {
    const depStatus = depStatusFromEdgeData(edge.data) ?? "blocked";
    // Keep the prior visual language:
    // - `unblocked`: solid line
    // - `blocked` / `failed`: dashed line (color distinguishes failure)
    const strokeDasharray = depStatus === "unblocked" ? "0" : "6 3";

    return {
      ...edge,
      style: {
        ...(edge.style || {}),
        stroke: edgeColors[depStatus],
        strokeDasharray,
        strokeWidth: 2,
      },
    };
  });
};
