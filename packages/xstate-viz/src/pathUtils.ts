import { Point } from './Rect';

interface Vector {
  type: 'vector';
  x: number;
  y: number;
}

const lineToVector = (p1: Point, p2: Point): Vector => {
  const vector = {
    type: 'vector' as const,
    x: p2.x - p1.x,
    y: p2.y - p1.y
  };

  return vector;
};

const vectorToUnitVector = (v: Vector): Vector => {
  let magnitude = v.x * v.x + v.y * v.y;
  magnitude = Math.sqrt(magnitude);
  const unitVector = {
    type: 'vector' as const,
    x: v.x / magnitude,
    y: v.y / magnitude
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
  radius: number = 10
): CubicCurve => {
  const corner_to_p1 = lineToVector(corner, p1);
  const corner_to_p2 = lineToVector(corner, p2);
  const corner_to_p1_unit = vectorToUnitVector(corner_to_p1);
  const corner_to_p2_unit = vectorToUnitVector(corner_to_p2);

  const curve_p1 = {
    x: corner.x + corner_to_p1_unit.x * radius,
    y: corner.y + corner_to_p1_unit.y * radius
  };
  const curve_p2 = {
    x: corner.x + corner_to_p2_unit.x * radius,
    y: corner.y + corner_to_p2_unit.y * radius
  };
  const path = {
    p1: curve_p1,
    p2: curve_p2,
    p: corner
  };

  return path;
};
