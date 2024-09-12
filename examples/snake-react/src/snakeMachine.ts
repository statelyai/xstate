import { fromCallback, or, setup, assign } from 'xstate';

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

export const snakeMachine = setup({
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
    'move snake': assign({
      snake: ({ context }) => moveSnake(context.snake, context.dir)
    }),
    'save dir': assign({
      dir: ({ context, event }) => {
        return event.type === 'ARROW_KEY'
          ? event.dir !== oppositeDir[context.dir]
            ? event.dir
            : context.dir
          : context.dir;
      }
    }),
    'increase score': assign({
      score: ({ context }) => context.score + 1,
      highScore: ({ context }) => Math.max(context.score + 1, context.highScore)
    }),
    'show new apple': assign({
      apple: ({ context }) => newApple(context.gridSize, context.snake)
    }),
    'grow snake': assign({ snake: ({ context }) => growSnake(context.snake) }),
    reset: assign(({ context }) => ({
      ...createInitialContext(),
      highScore: context.highScore
    }))
  },
  actors: {
    ticks: fromCallback(({ sendBack }) => {
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
        ARROW_KEY: {
          actions: 'save dir',
          target: 'Moving'
        }
      }
    },
    Moving: {
      entry: 'move snake',
      invoke: {
        src: 'ticks'
      },
      always: [
        {
          guard: 'ate apple',
          actions: ['grow snake', 'increase score', 'show new apple']
        },
        {
          guard: or(['hit tail', 'hit wall']),
          target: 'Game Over'
        }
      ],
      on: {
        TICK: {
          actions: 'move snake'
        },
        ARROW_KEY: {
          actions: 'save dir',
          target: 'Moving'
        }
      }
    },
    'Game Over': {
      on: {
        NEW_GAME: {
          actions: 'reset',
          description: 'triggered by pressing the "r" key',
          target: 'New Game'
        }
      }
    }
  }
});
