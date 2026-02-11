export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export const dedupeConsecutivePoints = (points: Point[]): Point[] => {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    if (!previous) return true;

    return previous.x !== point.x || previous.y !== point.y;
  });
};

export const dedupeNearPoints = (points: Point[], epsilon = 0.5): Point[] => {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    if (!previous) return true;

    return (
      Math.abs(previous.x - point.x) > epsilon ||
      Math.abs(previous.y - point.y) > epsilon
    );
  });
};

export const areCollinear = (
  pointA: Point,
  pointB: Point,
  pointC: Point,
): boolean => {
  const crossProduct =
    (pointB.x - pointA.x) * (pointC.y - pointA.y) -
    (pointB.y - pointA.y) * (pointC.x - pointA.x);

  return Math.abs(crossProduct) < 0.01;
};

export const simplifyCollinearPoints = (points: Point[]): Point[] => {
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

export const toPath = (points: Point[]): string => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  const [start, ...rest] = points;
  return `M ${start.x},${start.y} ${rest.map((point) => `L ${point.x},${point.y}`).join(" ")}`;
};

export const isPointInRectWithPadding = (
  point: Point,
  rect: Rect,
  padding: number,
): boolean => {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
};

export const isPointInAnyRectWithPadding = (
  point: Point,
  rects: Rect[],
  padding: number,
): boolean => {
  return rects.some((rect) => isPointInRectWithPadding(point, rect, padding));
};

export const doesSegmentIntersectRectWithPadding = (
  segmentStart: Point,
  segmentEnd: Point,
  rect: Rect,
  padding: number,
): boolean => {
  const minX = rect.x - padding;
  const maxX = rect.x + rect.width + padding;
  const minY = rect.y - padding;
  const maxY = rect.y + rect.height + padding;

  // The routing layer only emits orthogonal segments. Any diagonal segment is
  // treated as non-intersecting here because it indicates an invalid caller.
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
