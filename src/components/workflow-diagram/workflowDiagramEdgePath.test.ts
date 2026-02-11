import { describe, expect, it } from "vitest";

import { buildWorkflowDiagramEdgePath } from "./workflowDiagramEdgePath";

const pointsFromPath = (path: string): Array<{ x: number; y: number }> => {
  const matches = [...path.matchAll(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g)];
  return matches.map((match) => {
    const [x, y] = match[0].split(",").map(Number);
    return { x, y };
  });
};

const turnCountFromPath = (path: string): number => {
  const points = pointsFromPath(path);
  if (points.length <= 2) return 0;

  let turns = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const isTurn =
      (prev.x !== current.x || prev.y !== current.y) &&
      (current.x !== next.x || current.y !== next.y) &&
      !(prev.x === current.x && current.x === next.x) &&
      !(prev.y === current.y && current.y === next.y);

    if (isTurn) turns += 1;
  }

  return turns;
};

const finalHorizontalSegmentLength = (path: string): number => {
  const points = pointsFromPath(path);
  if (points.length < 2) return 0;

  const prev = points[points.length - 2];
  const last = points[points.length - 1];
  if (prev.y !== last.y) return 0;

  return Math.abs(last.x - prev.x);
};

const pathIntersectsRectWithPadding = ({
  nodeRect,
  padding,
  path,
}: {
  nodeRect: { height: number; width: number; x: number; y: number };
  padding: number;
  path: string;
}): boolean => {
  const points = pointsFromPath(path);
  const minX = nodeRect.x - padding;
  const maxX = nodeRect.x + nodeRect.width + padding;
  const minY = nodeRect.y - padding;
  const maxY = nodeRect.y + nodeRect.height + padding;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    if (start.y === end.y) {
      if (start.y < minY || start.y > maxY) continue;
      const segMinX = Math.min(start.x, end.x);
      const segMaxX = Math.max(start.x, end.x);
      if (segMaxX > minX && segMinX < maxX) return true;
      continue;
    }

    if (start.x === end.x) {
      if (start.x < minX || start.x > maxX) continue;
      const segMinY = Math.min(start.y, end.y);
      const segMaxY = Math.max(start.y, end.y);
      if (segMaxY > minY && segMinY < maxY) return true;
    }
  }

  return false;
};

describe("buildWorkflowDiagramEdgePath", () => {
  it("keeps same-row edges straight", () => {
    const path = buildWorkflowDiagramEdgePath({
      sourceX: 256,
      sourceY: 86,
      targetX: 712,
      targetY: 86,
    });

    expect(path).toBe("M 256,86 L 712,86");
    expect(turnCountFromPath(path)).toBe(0);
  });

  it("uses a simple two-bend path aligned to dagre lane", () => {
    const path = buildWorkflowDiagramEdgePath({
      dagrePoints: [
        { x: 221.23, y: 0 },
        { x: 306, y: -20 },
        { x: 484, y: -20 },
        { x: 662, y: -20 },
        { x: 746.76, y: 0 },
      ],
      sourceX: 256,
      sourceY: 86,
      targetX: 712,
      targetY: 22,
    });

    expect(path).toBe("M 256,86 L 306,86 L 306,22 L 712,22");
    expect(turnCountFromPath(path)).toBe(2);
  });

  it("keeps a visible final horizontal segment into target", () => {
    const path = buildWorkflowDiagramEdgePath({
      dagrePoints: [{ x: 298, y: 20 }],
      sourceX: 100,
      sourceY: 20,
      targetX: 300,
      targetY: 140,
    });

    expect(path).toBe("M 100,20 L 280,20 L 280,140 L 300,140");
    expect(finalHorizontalSegmentLength(path)).toBeGreaterThanOrEqual(20);
  });

  it("keeps a visible final horizontal segment for right-to-left edges", () => {
    const path = buildWorkflowDiagramEdgePath({
      dagrePoints: [{ x: 210, y: 20 }],
      sourceX: 300,
      sourceY: 20,
      targetX: 200,
      targetY: 140,
    });

    const points = pointsFromPath(path);
    const bendX = points[1]?.x;

    expect(points.length).toBe(4);
    expect(turnCountFromPath(path)).toBe(2);
    expect(bendX).toBeGreaterThanOrEqual(220);
    expect(finalHorizontalSegmentLength(path)).toBeGreaterThanOrEqual(20);
  });

  it("nudges bend lane when no-turn zones block baseline turns", () => {
    const path = buildWorkflowDiagramEdgePath({
      dagrePoints: [{ x: 160, y: 20 }],
      nodeRects: [{ height: 40, width: 40, x: 140, y: 0 }],
      sourceX: 100,
      sourceY: 20,
      targetX: 300,
      targetY: 140,
    });

    expect(path).toBe("M 100,20 L 120,20 L 120,140 L 300,140");
    expect(turnCountFromPath(path)).toBe(2);
  });

  it("reroutes around intervening nodes while keeping two bends", () => {
    const blockingNode = { height: 44, width: 256, x: 220, y: 118 };
    const path = buildWorkflowDiagramEdgePath({
      dagrePoints: [{ x: 300, y: 20 }],
      nodeRects: [blockingNode],
      sourceX: 100,
      sourceY: 20,
      targetX: 640,
      targetY: 140,
    });

    const points = pointsFromPath(path);

    expect(points.length).toBe(4);
    expect(points[0]).toEqual({ x: 100, y: 20 });
    expect(points[3]).toEqual({ x: 640, y: 140 });
    expect(points[1].x).toBeGreaterThan(
      blockingNode.x + blockingNode.width + 12,
    );
    expect(points[1].x).toEqual(points[2].x);
    expect(points[2].y).toBe(140);
    expect(turnCountFromPath(path)).toBe(2);
    expect(finalHorizontalSegmentLength(path)).toBeGreaterThanOrEqual(20);
    expect(
      pathIntersectsRectWithPadding({
        nodeRect: blockingNode,
        padding: 12,
        path,
      }),
    ).toBe(false);
  });

  it("uses a near-target bend to avoid crossing a same-row sibling node", () => {
    const siblingNode = { height: 44, width: 256, x: 1170, y: 211 };
    const path = buildWorkflowDiagramEdgePath({
      dagrePoints: [{ x: 1100, y: 86 }],
      nodeRects: [siblingNode],
      sourceX: 1032,
      sourceY: 86,
      targetX: 1650,
      targetY: 233,
    });

    const points = pointsFromPath(path);
    const bendX = points[1]?.x;

    expect(points.length).toBe(4);
    expect(turnCountFromPath(path)).toBe(2);
    expect(bendX).toBeGreaterThan(siblingNode.x + siblingNode.width + 12);
    expect(finalHorizontalSegmentLength(path)).toBeGreaterThanOrEqual(20);
    expect(
      pathIntersectsRectWithPadding({
        nodeRect: siblingNode,
        padding: 12,
        path,
      }),
    ).toBe(false);
  });

  it("falls back to baseline lane when candidate probing finds no safe lane", () => {
    const impossibleLaneBlocker = {
      height: 40,
      width: 20000,
      x: -10000,
      y: 60,
    };
    const path = buildWorkflowDiagramEdgePath({
      dagrePoints: [{ x: 200, y: 20 }],
      nodeRects: [impossibleLaneBlocker],
      sourceX: 100,
      sourceY: 20,
      targetX: 300,
      targetY: 140,
    });

    const points = pointsFromPath(path);

    expect(points[1]?.x).toBe(200);
    expect(points[2]?.x).toBe(200);
    expect(
      pathIntersectsRectWithPadding({
        nodeRect: impossibleLaneBlocker,
        padding: 12,
        path,
      }),
    ).toBe(true);
  });

  it("adds an approach lane when target y-offset is requested", () => {
    const path = buildWorkflowDiagramEdgePath({
      dagrePoints: [{ x: 160, y: 20 }],
      sourceX: 100,
      sourceY: 20,
      targetApproachYOffset: -12,
      targetX: 300,
      targetY: 140,
    });

    expect(path).toBe(
      "M 100,20 L 160,20 L 160,128 L 280,128 L 280,140 L 300,140",
    );
    expect(turnCountFromPath(path)).toBe(4);
    expect(finalHorizontalSegmentLength(path)).toBeGreaterThanOrEqual(20);
  });

  it("supports a shared preferred merge x for multi-edge convergence", () => {
    const topPath = buildWorkflowDiagramEdgePath({
      dagrePoints: [{ x: 420, y: 100 }],
      preferredBendX: 760,
      sourceX: 200,
      sourceY: 100,
      targetX: 800,
      targetY: 300,
    });

    const bottomPath = buildWorkflowDiagramEdgePath({
      dagrePoints: [{ x: 460, y: 500 }],
      preferredBendX: 760,
      sourceX: 200,
      sourceY: 500,
      targetX: 800,
      targetY: 300,
    });

    const topPoints = pointsFromPath(topPath);
    const bottomPoints = pointsFromPath(bottomPath);

    expect(topPoints[1].x).toBe(760);
    expect(bottomPoints[1].x).toBe(760);
    expect(turnCountFromPath(topPath)).toBe(2);
    expect(turnCountFromPath(bottomPath)).toBe(2);
  });
});
