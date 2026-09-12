import { createMachine, createCallbackLogic, types } from 'xstate';

export type Dir = 'Up' | 'Left' | 'Down' | 'Right';
export type Point = { x: number; y: number };
export type BodyPart = Point & { dir: Dir };
export type Snake = BodyPart[];

export type SnakeMachineContext = {
  snake: Snake;
  gridSize: Point;
  dir: Dir;
  apple: Point;
  score: number;
  highScore: number;
};

export type GameObject =
  | { type: 'head'; dir: Dir }
  | { type: 'body'; dir: Dir }
  | { type: 'apple'; dir: undefined };
const oppositeDir: Record<Dir, Dir> = {
  Up: 'Down',
  Down: 'Up',
  Left: 'Right',
  Right: 'Left'
};

function isSamePos(p1: Point, p2: Point) {
  return p1.x === p2.x && p1.y === p2.y;
}

function isOutsideGrid(gridSize: Point, p: Point) {
  return p.x < 0 || p.x >= gridSize.x || p.y < 0 || p.y >= gridSize.y;
}

function find<T extends Point>(points: T[], p: Point) {
  return points.find((pp) => isSamePos(pp, p));
}

function head(snake: Snake) {
  return snake[0];
}

function body(snake: Snake) {
  return snake.slice(1);
}

function newHead(oldHead: BodyPart, dir: Dir): BodyPart {
  switch (dir) {
    case 'Up':
      return { x: oldHead.x, y: oldHead.y - 1, dir };
    case 'Down':
      return { x: oldHead.x, y: oldHead.y + 1, dir };
    case 'Left':
      return { x: oldHead.x - 1, y: oldHead.y, dir };
    case 'Right':
      return { x: oldHead.x + 1, y: oldHead.y, dir };
  }
}

function moveSnake(snake: Snake, dir: Dir): Snake {
  return [newHead(head(snake), dir), ...snake.slice(0, -1)];
}

function newApple(
  gridSize: Point,
  ineligibleGridPoints: Point[]
): Point | undefined {
  const occupied = new Set(ineligibleGridPoints.map(({ x, y }) => `${x},${y}`));
  const available: Point[] = [];
  for (let y = 0; y < gridSize.y; y++) {
    for (let x = 0; x < gridSize.x; x++) {
      if (!occupied.has(`${x},${y}`)) available.push({ x, y });
    }
  }
  return available[Math.floor(Math.random() * available.length)];
}

function growSnake(snake: Snake): Snake {
  return [...snake, snake[snake.length - 1]];
}

function makeInitialSnake(gridSize: Point): Snake {
  const head: BodyPart = {
    x: Math.floor(gridSize.x / 2),
    y: Math.floor(gridSize.y / 2),
    dir: 'Right'
  };
  return [head, { ...head, x: head.x - 1 }, { ...head, x: head.x - 2 }];
}

function makeInitialApple(gridSize: Point): Point {
  return {
    x: Math.floor((gridSize.x * 3) / 4),
    y: Math.floor(gridSize.y / 2)
  };
}

export function createInitialContext(): SnakeMachineContext {
  const gridSize: Point = { x: 25, y: 15 };
  return {
    gridSize,
    snake: makeInitialSnake(gridSize),
    apple: makeInitialApple(gridSize),
    score: 0,
    highScore: 0,
    dir: 'Right'
  };
}

export const snakeMachine = createMachine({
  schemas: {
    context: types<SnakeMachineContext>(),
    events: {
      NEW_GAME: types<{}>(),
      ARROW_KEY: types<{ dir: Dir }>(),
      TICK: types<{}>()
    }
  },
  actors: {
    ticks: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => sendBack({ type: 'TICK' }), 80);
      return () => clearInterval(interval);
    })
  },
  id: 'SnakeMachine',
  context: createInitialContext(),
  initial: 'New Game',
  states: {
    'New Game': {
      on: {
        ARROW_KEY: ({ context, event }) => ({
          target: 'Moving',
          context: {
            ...context,
            dir:
              event.dir === oppositeDir[context.dir] ? context.dir : event.dir
          }
        })
      }
    },
    Moving: {
      entry: ({ context }) => ({
        context: { ...context, snake: moveSnake(context.snake, context.dir) }
      }),
      invoke: { src: 'ticks' },
      always: ({ context }) => {
        if (
          isOutsideGrid(context.gridSize, head(context.snake)) ||
          find(body(context.snake), head(context.snake))
        ) {
          return { target: 'Game Over' };
        }
        if (isSamePos(head(context.snake), context.apple)) {
          const snake = growSnake(context.snake);
          const apple =
            snake.length < context.gridSize.x * context.gridSize.y
              ? newApple(context.gridSize, snake)
              : undefined;
          return {
            target: apple ? undefined : 'Game Over',
            context: {
              ...context,
              snake,
              score: context.score + 1,
              highScore: Math.max(context.score + 1, context.highScore),
              apple: apple ?? context.apple
            }
          };
        }
      },
      on: {
        TICK: ({ context }) => ({
          context: { ...context, snake: moveSnake(context.snake, context.dir) }
        }),
        ARROW_KEY: ({ context, event }) => ({
          context: {
            ...context,
            dir:
              event.dir === oppositeDir[context.dir] ? context.dir : event.dir
          }
        })
      }
    },
    'Game Over': {
      on: {
        NEW_GAME: ({ context }) => ({
          target: 'New Game',
          context: { ...createInitialContext(), highScore: context.highScore }
        })
      }
    }
  }
});
