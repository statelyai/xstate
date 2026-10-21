import { setup, types, createCallbackLogic } from 'xstate';

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

type GameObject =
  | { type: 'head'; dir: Dir }
  | { type: 'body'; dir: Dir }
  | { type: 'apple'; dir: undefined };
export function getGamObjectAtPos(
  snake: Snake,
  apple: Point,
  dir: Dir,
  p: Point
): GameObject | undefined {
  let maybeBodyPart: BodyPart | undefined;
  if (isSamePos(head(snake), p)) {
    return { type: 'head', dir };
  } else if (isSamePos(apple, p)) {
    return { type: 'apple', dir: undefined };
  } else if ((maybeBodyPart = find(body(snake), p))) {
    return { type: 'body', dir: maybeBodyPart.dir };
  } else {
    return undefined;
  }
}

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

function randomGridPoint(gridSize: Point): Point {
  return {
    x: Math.floor(Math.random() * gridSize.x),
    y: Math.floor(Math.random() * gridSize.y)
  };
}

function newApple(gridSize: Point, ineligibleGridPoints: Point[]) {
  let newApple = randomGridPoint(gridSize);
  while (find(ineligibleGridPoints, newApple)) {
    newApple = randomGridPoint(gridSize);
  }
  return newApple;
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

function ateApple(snake: Snake, apple: Point) {
  return isSamePos(head(snake), apple);
}

function hitTail(snake: Snake) {
  return !!find(body(snake), head(snake));
}

function hitWall(gridSize: Point, snake: Snake) {
  return isOutsideGrid(gridSize, head(snake));
}

/** The direction the snake should face after an arrow key, ignoring 180° turns. */
function nextDir(currentDir: Dir, dir: Dir): Dir {
  return dir !== oppositeDir[currentDir] ? dir : currentDir;
}

export const snakeMachine = setup({
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
      const i = setInterval(() => {
        sendBack({ type: 'TICK' });
      }, 80);

      return () => clearInterval(i);
    })
  }
}).createMachine({
  id: 'SnakeMachine',
  context: createInitialContext(),
  initial: 'New Game',
  states: {
    'New Game': {
      on: {
        ARROW_KEY: ({ context, event }) => ({
          target: 'Moving',
          context: { dir: nextDir(context.dir, event.dir) }
        })
      }
    },
    Moving: {
      entry: ({ context }) => ({
        context: { snake: moveSnake(context.snake, context.dir) }
      }),
      invoke: {
        src: 'ticks'
      },
      // Eventless transition: re-runs after every context change, so eating an
      // apple is resolved before the collision check on the next pass.
      always: ({ context }) => {
        if (ateApple(context.snake, context.apple)) {
          const snake = growSnake(context.snake);

          return {
            context: {
              snake,
              score: context.score + 1,
              highScore: Math.max(context.score + 1, context.highScore),
              apple: newApple(context.gridSize, snake)
            }
          };
        }

        if (
          hitTail(context.snake) ||
          hitWall(context.gridSize, context.snake)
        ) {
          return { target: 'Game Over' };
        }
      },
      on: {
        TICK: ({ context }) => ({
          context: { snake: moveSnake(context.snake, context.dir) }
        }),
        // Re-entering `Moving` moves the snake immediately, so a keypress
        // feels responsive instead of waiting for the next tick.
        ARROW_KEY: ({ context, event }) => ({
          target: 'Moving',
          context: { dir: nextDir(context.dir, event.dir) }
        })
      }
    },
    'Game Over': {
      on: {
        // Triggered by pressing the "r" key
        NEW_GAME: ({ context }) => ({
          target: 'New Game',
          context: { ...createInitialContext(), highScore: context.highScore }
        })
      }
    }
  }
});
