import { createMachine, createCallbackLogic, or } from 'xstate';

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
  context: SnakeMachineContext,
  p: Point
): GameObject | undefined {
  let maybeBodyPart: BodyPart | undefined;
  if (isSamePos(head(context.snake), p)) {
    return { type: 'head', dir: context.dir };
  } else if (isSamePos(context.apple, p)) {
    return { type: 'apple', dir: undefined };
  } else if ((maybeBodyPart = find(body(context.snake), p))) {
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

export const snakeMachine = createMachine({
  types: {
    context: {} as SnakeMachineContext,
    events: {} as
      | { type: 'NEW_GAME' }
      | { type: 'ARROW_KEY'; dir: Dir }
      | { type: 'TICK' }
  },
  guards: {
    'ate apple': ({ context }) => isSamePos(head(context.snake), context.apple),
    'hit tail': ({ context }) =>
      !!find(body(context.snake), head(context.snake)),
    'hit wall': ({ context }) =>
      isOutsideGrid(context.gridSize, head(context.snake))
  },
  actions: {
    'move snake': ({ context }) => ({
      context: { ...context, snake: moveSnake(context.snake, context.dir) }
    }),
    'save dir': ({ context, event }) => ({
      context: {
        ...context,
        dir:
          event.type === 'ARROW_KEY'
            ? event.dir !== oppositeDir[context.dir]
              ? event.dir
              : context.dir
            : context.dir
      }
    }),
    'increase score': ({ context }) => ({
      context: {
        ...context,
        score: context.score + 1,
        highScore: Math.max(context.score + 1, context.highScore)
      }
    }),
    'show new apple': ({ context }) => ({
      context: { ...context, apple: newApple(context.gridSize, context.snake) }
    }),
    'grow snake': ({ context }) => ({
      context: { ...context, snake: growSnake(context.snake) }
    }),
    reset: ({ context }) => ({
      context: {
        ...createInitialContext(),
        highScore: context.highScore
      }
    })
  },
  actorSources: {
    ticks: createCallbackLogic(({ sendBack }) => {
      const i = setInterval(() => {
        sendBack({ type: 'TICK' });
      }, 80);

      return () => clearInterval(i);
    })
  },
  id: 'SnakeMachine',

  context: createInitialContext(),
  initial: 'New Game',
  states: {
    'New Game': {
      on: {
        ARROW_KEY: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['save dir'](actionArgs as any));
          return { target: 'Moving' };
        }
      }
    },
    Moving: {
      entry: (args, enq) => {
        enq((actionArgs) => args.actions['move snake'](actionArgs as any));
      },
      invoke: {
        src: 'ticks'
      },
      always: [
        ({ context, event, guards, actions }, enq) => {
          if (!guards['ate apple']({ context, event })) {
            return;
          }
          enq((actionArgs) => actions['grow snake'](actionArgs as any));
          enq((actionArgs) => actions['increase score'](actionArgs as any));
          enq((actionArgs) => actions['show new apple'](actionArgs as any));
        },
        ({ context, event, guards, actions }, enq) => {
          if (!or(['hit tail', 'hit wall'])({ context, event })) {
            return;
          }
          return { target: 'Game Over' };
        }
      ],
      on: {
        TICK: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['move snake'](actionArgs as any));
        },
        ARROW_KEY: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['save dir'](actionArgs as any));
          return { target: 'Moving' };
        }
      }
    },
    'Game Over': {
      on: {
        NEW_GAME: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['reset'](actionArgs as any));
          return {
            description: 'triggered by pressing the "r" key',
            target: 'New Game'
          };
        }
      }
    }
  }
});
