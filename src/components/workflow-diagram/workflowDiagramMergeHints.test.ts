import type { Edge, Node } from "@xyflow/react";

import { describe, expect, it } from "vitest";

import { withPreferredTargetMergeX } from "./workflowDiagramMergeHints";

const node = (id: string, x: number, y: number): Node => ({
  data: {},
  height: 44,
  id,
  position: { x, y },
  width: 256,
});

const edge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
});

const preferredBendX = (edgeData: unknown): number | undefined => {
  if (!edgeData || typeof edgeData !== "object") return undefined;
  const value = (edgeData as { preferredBendX?: unknown }).preferredBendX;
  return typeof value === "number" ? value : undefined;
};

describe("withPreferredTargetMergeX", () => {
  it("assigns a shared preferred bend x to off-row incoming edges", () => {
    const nodes = [
      node("source-above", 100, 20),
      node("source-same-row", 100, 200),
      node("source-below", 100, 360),
      node("target", 1000, 200),
    ];
    const edges = [
      edge("e-above", "source-above", "target"),
      edge("e-same-row", "source-same-row", "target"),
      edge("e-below", "source-below", "target"),
    ];

    const hintedEdges = withPreferredTargetMergeX(edges, nodes);
    const byID = new Map(hintedEdges.map((item) => [item.id, item]));

    expect(preferredBendX(byID.get("e-above")?.data)).toBe(980);
    expect(preferredBendX(byID.get("e-below")?.data)).toBe(980);
    expect(preferredBendX(byID.get("e-same-row")?.data)).toBeUndefined();
  });

  it("does not assign preferred bend x when there is no same-row incoming edge", () => {
    const nodes = [
      node("source-above", 100, 20),
      node("source-below", 100, 360),
      node("target", 1000, 200),
    ];
    const edges = [
      edge("e-above", "source-above", "target"),
      edge("e-below", "source-below", "target"),
    ];

    const hintedEdges = withPreferredTargetMergeX(edges, nodes);
    const byID = new Map(hintedEdges.map((item) => [item.id, item]));

    expect(preferredBendX(byID.get("e-above")?.data)).toBeUndefined();
    expect(preferredBendX(byID.get("e-below")?.data)).toBeUndefined();
  });
});
