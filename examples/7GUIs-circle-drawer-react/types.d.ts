import React from 'react';

declare global {
  export type Position = { x: number; y: number };

  export type Circles = Circle[null];

  export type Circle = {
    id?: string;
    radius?: number;
    color?: string;
    position?: Position;
  } | null;
}
