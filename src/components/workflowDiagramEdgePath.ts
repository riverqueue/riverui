export type WorkflowDiagramNodeRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type Point = {
  x: number;
  y: number;
};

// Extra padding around each node card where edge turns are not allowed.
const turnNodePadding = 12;
// Keep the final horizontal segment into the target handle visibly long.
const minTargetApproach = 20;
// Search granularity when probing for an alternate bend lane.
const bendNudgeStep = 8;
// Upper bound on probing attempts for an alternate bend lane.
const bendNudgeMaxSteps = 24;

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

This preserves the original routing as much as possible while fixing only the
connections that need adjustment.
*/

const dedupeConsecutivePoints = (points: Point[]): Point[] => {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    if (!previous) return true;

    return previous.x !== point.x || previous.y !== point.y;
  });
};

const dedupeNearPoints = (points: Point[], epsilon = 0.5): Point[] => {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    if (!previous) return true;

    return (
      Math.abs(previous.x - point.x) > epsilon ||
      Math.abs(previous.y - point.y) > epsilon
    );
  });
};

const areCollinear = (pointA: Point, pointB: Point, pointC: Point): boolean => {
  const crossProduct =
    (pointB.x - pointA.x) * (pointC.y - pointA.y) -
    (pointB.y - pointA.y) * (pointC.x - pointA.x);

  return Math.abs(crossProduct) < 0.01;
};

const simplifyCollinearPoints = (points: Point[]): Point[] => {
  if (points.length <= 2) return points;

  const simplified: Point[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1];
    const current = points[index];
    const next = points[index + 1];

    if (!areCollinear(previous, current, next)) {
      simplified.push(current);
    }
  }

  simplified.push(points[points.length - 1]);
  return simplified;
};

const isPointInRectWithPadding = (
  point: Point,
  nodeRect: WorkflowDiagramNodeRect,
  padding: number,
): boolean => {
  return (
    point.x >= nodeRect.x - padding &&
    point.x <= nodeRect.x + nodeRect.width + padding &&
    point.y >= nodeRect.y - padding &&
    point.y <= nodeRect.y + nodeRect.height + padding
  );
};

const isPointInAnyRectWithPadding = (
  point: Point,
  nodeRects: WorkflowDiagramNodeRect[],
  padding: number,
): boolean => {
  return nodeRects.some((nodeRect) =>
    isPointInRectWithPadding(point, nodeRect, padding),
  );
};

const toPath = (points: Point[]): string => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  const [start, ...rest] = points;
  return `M ${start.x},${start.y} ${rest.map((point) => `L ${point.x},${point.y}`).join(" ")}`;
};

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

const isPathTurnSafe = (
  points: Point[],
  nodeRects: WorkflowDiagramNodeRect[],
): boolean => {
  const turnPoints = getTurnPoints(points);

  return turnPoints.every(
    (turnPoint) =>
      !isPointInAnyRectWithPadding(turnPoint, nodeRects, turnNodePadding),
  );
};

const getBlockingRectsForPathTurns = (
  points: Point[],
  nodeRects: WorkflowDiagramNodeRect[],
): WorkflowDiagramNodeRect[] => {
  const turnPoints = getTurnPoints(points);
  if (turnPoints.length === 0) return [];

  return nodeRects.filter((nodeRect) =>
    turnPoints.some((turnPoint) =>
      isPointInRectWithPadding(turnPoint, nodeRect, turnNodePadding),
    ),
  );
};

const isEndpointRect = (
  nodeRect: WorkflowDiagramNodeRect,
  source: Point,
  target: Point,
): boolean => {
  return (
    isPointInRectWithPadding(source, nodeRect, 0) ||
    isPointInRectWithPadding(target, nodeRect, 0)
  );
};

const doesSegmentIntersectRectWithPadding = (
  segmentStart: Point,
  segmentEnd: Point,
  nodeRect: WorkflowDiagramNodeRect,
  padding: number,
): boolean => {
  const minX = nodeRect.x - padding;
  const maxX = nodeRect.x + nodeRect.width + padding;
  const minY = nodeRect.y - padding;
  const maxY = nodeRect.y + nodeRect.height + padding;

  if (segmentStart.y === segmentEnd.y) {
    const segmentY = segmentStart.y;
    if (segmentY < minY || segmentY > maxY) return false;

    const segmentMinX = Math.min(segmentStart.x, segmentEnd.x);
    const segmentMaxX = Math.max(segmentStart.x, segmentEnd.x);

    return segmentMaxX > minX && segmentMinX < maxX;
  }

  if (segmentStart.x === segmentEnd.x) {
    const segmentX = segmentStart.x;
    if (segmentX < minX || segmentX > maxX) return false;

    const segmentMinY = Math.min(segmentStart.y, segmentEnd.y);
    const segmentMaxY = Math.max(segmentStart.y, segmentEnd.y);

    return segmentMaxY > minY && segmentMinY < maxY;
  }

  return false;
};

const isPathSegmentSafe = ({
  nodeRects,
  points,
  source,
  target,
}: {
  nodeRects: WorkflowDiagramNodeRect[];
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
  nodeRects: WorkflowDiagramNodeRect[];
  points: Point[];
  source: Point;
  target: Point;
}): WorkflowDiagramNodeRect[] => {
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
  blockingRects: WorkflowDiagramNodeRect[];
  source: Point;
  target: Point;
  targetApproachYOffset?: number;
}): number[] => {
  const candidates = new Set<number>([baselineX]);

  if (targetApproachYOffset === 0) {
    candidates.add(targetApproachBoundary({ source, target }));
  }

  // Try lanes just outside blocking node bounds first; these often produce the
  // smallest visible adjustment away from the baseline route.
  blockingRects.forEach((nodeRect) => {
    candidates.add(nodeRect.x - turnNodePadding);
    candidates.add(nodeRect.x + nodeRect.width + turnNodePadding);
  });

  for (let step = 1; step <= bendNudgeMaxSteps; step += 1) {
    const offset = step * bendNudgeStep;
    candidates.add(baselineX - offset);
    candidates.add(baselineX + offset);
  }

  // Keep search deterministic and local by preferring candidates nearest to the
  // baseline lane before trying farther nudges.
  return [...candidates].sort(
    (candidateA, candidateB) =>
      Math.abs(candidateA - baselineX) - Math.abs(candidateB - baselineX),
  );
};

const chooseValidBendX = ({
  baselineX,
  nodeRects,
  source,
  target,
  targetApproachYOffset = 0,
}: {
  baselineX: number;
  nodeRects: WorkflowDiagramNodeRect[];
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
  const targetApproachIsValid =
    targetApproachYOffset === 0
      ? isTargetApproachVisible({ bendX: baselineX, source, target })
      : true;

  if (
    isPathTurnSafe(baselinePath, nodeRects) &&
    isPathSegmentSafe({ nodeRects, points: baselinePath, source, target }) &&
    targetApproachIsValid
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
    const candidateTargetApproachIsValid =
      targetApproachYOffset === 0
        ? isTargetApproachVisible({ bendX, source, target })
        : true;

    if (
      isPathTurnSafe(candidatePath, nodeRects) &&
      isPathSegmentSafe({ nodeRects, points: candidatePath, source, target }) &&
      candidateTargetApproachIsValid
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
  nodeRects: WorkflowDiagramNodeRect[],
  preferredBendX: number | undefined,
  targetApproachYOffset = 0,
): Point[] => {
  // Straight line for same-row targets keeps simple cases unchanged.
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
