import { Point } from "./Rect";

interface Vector {
  type: "vector";
  x: number;
  y: number;
}

const lineToVector = (p1: Point, p2: Point): Vector => {
  const vector = {
    type: "vector" as const,
    x: p2.x - p1.x,
    y: p2.y - p1.y,
  };

  return vector;
};

const vectorToUnitVector = (v: Vector): Vector => {
  let magnitude = v.x * v.x + v.y * v.y;
  magnitude = Math.sqrt(magnitude);
  const unitVector = {
    type: "vector" as const,
    x: v.x / magnitude,
    y: v.y / magnitude,
  };
  return unitVector;
};

interface CubicCurve {
  p1: Point;
  p2: Point;
  p: Point;
}

export const roundOneCorner = (
  p1: Point,
  corner: Point,
  p2: Point,
  radius: number = 20
): CubicCurve => {
  const corner_to_p1 = lineToVector(corner, p1);
  const corner_to_p2 = lineToVector(corner, p2);
  const p1dist = Math.hypot(corner_to_p1.x, corner_to_p1.y);
  const p2dist = Math.hypot(corner_to_p2.x, corner_to_p2.y);
  if (p1dist * p2dist === 0) {
    return {
      p1: corner,
      p2: corner,
      p: corner,
    };
  }
  const resolvedRadius = Math.min(radius, p1dist - 0.1, p2dist - 0.1);
  const corner_to_p1_unit = vectorToUnitVector(corner_to_p1);
  const corner_to_p2_unit = vectorToUnitVector(corner_to_p2);

  const curve_p1 = {
    x: corner.x + corner_to_p1_unit.x * resolvedRadius,
    y: corner.y + corner_to_p1_unit.y * resolvedRadius,
  };
  const curve_p2 = {
    x: corner.x + corner_to_p2_unit.x * resolvedRadius,
    y: corner.y + corner_to_p2_unit.y * resolvedRadius,
  };
  const path = {
    p1: curve_p1,
    p2: curve_p2,
    p: corner,
  };

  return path;
};

export function simplifyPoints(points: Point[]): Point[] {
  const pointHashes = new Set<string>();

  const result: Point[] = [];

  points.forEach((point) => {
    const hash = `${point.x}|${point.y}`;

    if (pointHashes.has(hash)) {
      return;
    }

    result.push(point);
  });

  return result;
}

export function isBendable(p1: Point, corner: Point, p2: Point): boolean {
  return !(
    (p1.x === corner.x && p2.x === corner.x) ||
    (p1.y === corner.y && p2.y === corner.y)
  );
}

export function withMidpoints(points: Point[]): Point[] {
  const pointsWithMid: Point[] = [];

  points.forEach((pt, i) => {
    const [ptA, ptB, ptC] = [pt, points[i + 1], points[i + 2]];

    if (!ptC || !ptB) {
      pointsWithMid.push(ptA);
      return;
    }

    if (ptA.command === "M" || ptB.command === "M" || ptC.command === "M") {
      pointsWithMid.push(ptA);
      return;
    }

    const midpt = {
      x: ptA.x + (ptB.x - ptA.x) / 2,
      y: ptA.y + (ptB.y - ptA.y) / 2,
      color: "green",
      label: "midpoint",
    };

    pointsWithMid.push(ptA, midpt);
  });

  return pointsWithMid;
}

export type PointFn = (pt: Point) => Point | Point[] | undefined;

export function resolvePoints(
  ptFns: Array<PointFn>,
  initialPt: Point = ptFns[0](null as any) as Point
): Point[] {
  return ptFns.reduce(
    (acc, pointFn) => {
      const prevPoint = acc[acc.length - 1];

      const nextPoint = pointFn(prevPoint);

      if (!nextPoint) {
        return acc;
      }

      return acc.concat(nextPoint);
    },
    [initialPt]
  );
}
