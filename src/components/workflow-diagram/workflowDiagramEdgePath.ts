import {
  bendNudgeMaxSteps,
  bendNudgeStep,
  minTargetApproach,
  turnNodePadding,
} from "./workflowDiagramConstants";
import {
  areCollinear,
  dedupeConsecutivePoints,
  dedupeNearPoints,
  doesSegmentIntersectRectWithPadding,
  isPointInAnyRectWithPadding,
  isPointInRectWithPadding,
  type Point,
  type Rect,
  simplifyCollinearPoints,
  toPath,
} from "./workflowDiagramGeometry";

export type WorkflowDiagramNodeRect = Rect;

/*
Routing policy (left-to-right workflows):

1. Build the original-style Manhattan route with a single shared bend lane:
   `source -> (bendX, sourceY) -> (bendX, targetY) -> target`.
2. Prefer Dagre's interior lane for `bendX` to stay close to existing layout.
   If a shared merge lane is provided, try that lane first.
3. Keep that route unchanged unless it violates either:
   - no-turn zones (turn point inside any node + padding), or
   - node-body crossing (segment intersects a non-endpoint node), or
   - minimum visible target approach distance.
4. If invalid, probe nearby lanes and pick the nearest valid one.

`isCandidatePathValid` centralizes all route validity checks so baseline and
probed candidates use identical acceptance criteria.
*/

const toInteriorDagrePoints = (
  source: Point,
  target: Point,
  dagrePoints: Point[],
): Point[] => {
  const minX = Math.min(source.x, target.x);
  const maxX = Math.max(source.x, target.x);

  return dagrePoints.filter(
    (point) => point.x > minX + 1 && point.x < maxX - 1,
  );
};

const getBaselineBendX = (
  source: Point,
  target: Point,
  dagrePoints: Point[],
): number => {
  const interiorDagrePoints = toInteriorDagrePoints(
    source,
    target,
    dagrePoints,
  );
  if (interiorDagrePoints.length > 0) {
    // Follow Dagre's suggested lane when available.
    return interiorDagrePoints[0].x;
  }

  return source.x + (target.x - source.x) / 2;
};

const isTargetApproachVisible = ({
  bendX,
  source,
  target,
}: {
  bendX: number;
  source: Point;
  target: Point;
}): boolean => {
  if (source.x <= target.x) {
    return target.x - bendX >= minTargetApproach;
  }

  return bendX - target.x >= minTargetApproach;
};

const targetApproachBoundary = ({
  source,
  target,
}: {
  source: Point;
  target: Point;
}): number => {
  if (source.x <= target.x) return target.x - minTargetApproach;

  return target.x + minTargetApproach;
};

const isTurnPoint = (pointA: Point, pointB: Point, pointC: Point): boolean => {
  return !areCollinear(pointA, pointB, pointC);
};

const getTurnPoints = (points: Point[]): Point[] => {
  if (points.length <= 2) return [];

  const turns: Point[] = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    if (isTurnPoint(previous, current, next)) turns.push(current);
  }

  return turns;
};

const isPathTurnSafe = (points: Point[], nodeRects: Rect[]): boolean => {
  const turnPoints = getTurnPoints(points);

  return turnPoints.every(
    (turnPoint) =>
      !isPointInAnyRectWithPadding(turnPoint, nodeRects, turnNodePadding),
  );
};

const getBlockingRectsForPathTurns = (
  points: Point[],
  nodeRects: Rect[],
): Rect[] => {
  const turnPoints = getTurnPoints(points);
  if (turnPoints.length === 0) return [];

  return nodeRects.filter((nodeRect) =>
    turnPoints.some((turnPoint) =>
      isPointInRectWithPadding(turnPoint, nodeRect, turnNodePadding),
    ),
  );
};

const isEndpointRect = (
  nodeRect: Rect,
  source: Point,
  target: Point,
): boolean => {
  return (
    isPointInRectWithPadding(source, nodeRect, 0) ||
    isPointInRectWithPadding(target, nodeRect, 0)
  );
};

const isPathSegmentSafe = ({
  nodeRects,
  points,
  source,
  target,
}: {
  nodeRects: Rect[];
  points: Point[];
  source: Point;
  target: Point;
}): boolean => {
  const obstacleRects = nodeRects.filter(
    (nodeRect) => !isEndpointRect(nodeRect, source, target),
  );

  for (let index = 0; index < points.length - 1; index += 1) {
    const segmentStart = points[index];
    const segmentEnd = points[index + 1];

    const hitsObstacle = obstacleRects.some((nodeRect) =>
      doesSegmentIntersectRectWithPadding(
        segmentStart,
        segmentEnd,
        nodeRect,
        turnNodePadding,
      ),
    );
    if (hitsObstacle) return false;
  }

  return true;
};

const getBlockingRectsForPathSegments = ({
  nodeRects,
  points,
  source,
  target,
}: {
  nodeRects: Rect[];
  points: Point[];
  source: Point;
  target: Point;
}): Rect[] => {
  const obstacleRects = nodeRects.filter(
    (nodeRect) => !isEndpointRect(nodeRect, source, target),
  );

  return obstacleRects.filter((nodeRect) => {
    for (let index = 0; index < points.length - 1; index += 1) {
      if (
        doesSegmentIntersectRectWithPadding(
          points[index],
          points[index + 1],
          nodeRect,
          turnNodePadding,
        )
      ) {
        return true;
      }
    }

    return false;
  });
};

const buildPathForBendX = ({
  bendX,
  source,
  target,
  targetApproachYOffset = 0,
}: {
  bendX: number;
  source: Point;
  target: Point;
  targetApproachYOffset?: number;
}): Point[] => {
  if (source.y === target.y) {
    return [source, target];
  }

  if (targetApproachYOffset === 0) {
    return [
      source,
      { x: bendX, y: source.y },
      { x: bendX, y: target.y },
      target,
    ];
  }

  const approachX = targetApproachBoundary({ source, target });
  const laneY = target.y + targetApproachYOffset;

  return [
    source,
    { x: bendX, y: source.y },
    { x: bendX, y: laneY },
    { x: approachX, y: laneY },
    { x: approachX, y: target.y },
    target,
  ];
};

const buildBendXCandidates = ({
  baselineX,
  blockingRects,
  source,
  target,
  targetApproachYOffset = 0,
}: {
  baselineX: number;
  blockingRects: Rect[];
  source: Point;
  target: Point;
  targetApproachYOffset?: number;
}): number[] => {
  const candidates = new Set<number>([baselineX]);

  if (targetApproachYOffset === 0) {
    candidates.add(targetApproachBoundary({ source, target }));
  }

  // Try lanes just outside blocking node bounds first; these usually produce
  // the smallest visual change away from the baseline route.
  blockingRects.forEach((nodeRect) => {
    candidates.add(nodeRect.x - turnNodePadding);
    candidates.add(nodeRect.x + nodeRect.width + turnNodePadding);
  });

  for (let step = 1; step <= bendNudgeMaxSteps; step += 1) {
    const offset = step * bendNudgeStep;
    candidates.add(baselineX - offset);
    candidates.add(baselineX + offset);
  }

  // Keep search deterministic and local by prioritizing lanes nearest to the
  // original baseline before trying farther nudges.
  return [...candidates].sort(
    (candidateA, candidateB) =>
      Math.abs(candidateA - baselineX) - Math.abs(candidateB - baselineX),
  );
};

const isCandidatePathValid = ({
  bendX,
  nodeRects,
  points,
  source,
  target,
  targetApproachYOffset,
}: {
  bendX: number;
  nodeRects: Rect[];
  points: Point[];
  source: Point;
  target: Point;
  targetApproachYOffset: number;
}): boolean => {
  if (!isPathTurnSafe(points, nodeRects)) return false;
  if (!isPathSegmentSafe({ nodeRects, points, source, target })) return false;

  if (targetApproachYOffset === 0) {
    return isTargetApproachVisible({ bendX, source, target });
  }

  return true;
};

const chooseValidBendX = ({
  baselineX,
  nodeRects,
  source,
  target,
  targetApproachYOffset = 0,
}: {
  baselineX: number;
  nodeRects: Rect[];
  source: Point;
  target: Point;
  targetApproachYOffset?: number;
}): number => {
  const baselinePath = buildPathForBendX({
    bendX: baselineX,
    source,
    target,
    targetApproachYOffset,
  });
  const blockingTurnRects = getBlockingRectsForPathTurns(
    baselinePath,
    nodeRects,
  );
  const blockingSegmentRects = getBlockingRectsForPathSegments({
    nodeRects,
    points: baselinePath,
    source,
    target,
  });
  const blockingRects = [
    ...new Set([...blockingSegmentRects, ...blockingTurnRects]),
  ];

  if (
    isCandidatePathValid({
      bendX: baselineX,
      nodeRects,
      points: baselinePath,
      source,
      target,
      targetApproachYOffset,
    })
  ) {
    return baselineX;
  }

  const candidates = buildBendXCandidates({
    baselineX,
    blockingRects,
    source,
    target,
    targetApproachYOffset,
  });

  for (const bendX of candidates) {
    const candidatePath = buildPathForBendX({
      bendX,
      source,
      target,
      targetApproachYOffset,
    });

    if (
      isCandidatePathValid({
        bendX,
        nodeRects,
        points: candidatePath,
        source,
        target,
        targetApproachYOffset,
      })
    ) {
      return bendX;
    }
  }

  // Fall back to the baseline lane when probing fails so routing stays stable
  // and does not jump to unrelated coordinates.
  return baselineX;
};

const toOrthogonalPoints = (
  source: Point,
  target: Point,
  dagrePoints: Point[],
  nodeRects: Rect[],
  preferredBendX: number | undefined,
  targetApproachYOffset = 0,
): Point[] => {
  // Straight same-row edges should stay straight unless a target approach
  // offset explicitly asks for a merge lane detour.
  if (source.y === target.y && targetApproachYOffset === 0) {
    return [source, target];
  }

  const baselineX =
    preferredBendX ?? getBaselineBendX(source, target, dagrePoints);
  const bendX = chooseValidBendX({
    baselineX,
    nodeRects,
    source,
    target,
    targetApproachYOffset,
  });

  return buildPathForBendX({
    bendX,
    source,
    target,
    targetApproachYOffset,
  });
};

export const buildWorkflowDiagramEdgePath = ({
  dagrePoints,
  nodeRects,
  preferredBendX,
  sourceX,
  sourceY,
  targetApproachYOffset,
  targetX,
  targetY,
}: {
  dagrePoints?: Point[];
  nodeRects?: WorkflowDiagramNodeRect[];
  preferredBendX?: number;
  sourceX: number;
  sourceY: number;
  targetApproachYOffset?: number;
  targetX: number;
  targetY: number;
}): string => {
  const source = { x: sourceX, y: sourceY };
  const target = { x: targetX, y: targetY };

  const points = toOrthogonalPoints(
    source,
    target,
    dagrePoints || [],
    nodeRects || [],
    preferredBendX,
    targetApproachYOffset,
  );

  return toPath(
    simplifyCollinearPoints(dedupeNearPoints(dedupeConsecutivePoints(points))),
  );
};
