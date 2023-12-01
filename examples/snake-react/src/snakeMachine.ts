import { createMachine, fromCallback } from 'xstate';

type Dir = 'Up' | 'Left' | 'Down' | 'Right';
type Point = { x: number; y: number };
type BodyPart = Point & { dir: Dir };
type Snake = BodyPart[];

export type SnakeMachineContext = {
  snake: Snake;
  gridSize: Point;
  dir: Dir;
  apple: Point;
  score: number;
  highScore: number;
};

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
  id: 'SnakeMachine',
  types: {
    context: {} as SnakeMachineContext,
    events: {} as
      | { type: 'NEW_GAME' }
      | { type: 'ARROW_KEY'; dir: Dir }
      | { type: 'TICK' }
  },
  context: createInitialContext(),
  initial: 'New Game',
  states: {
    'New Game': {
      on: {
        ARROW_KEY: {
          actions: 'save dir',
          target: '#SnakeMachine.Moving'
        }
      }
    },
    Moving: {
      entry: 'move snake',
      invoke: {
        src: fromCallback(({ sendBack }) => {
          const i = setInterval(() => {
            sendBack({ type: 'TICK' });
          }, 80);

          return () => clearInterval(i);
        })
      },
      always: [
        {
          guard: 'ate apple',
          actions: ['grow snake', 'increase score', 'show new apple']
        },
        {
          guard: 'hit wall',
          target: '#SnakeMachine.Game Over'
        },
        {
          guard: 'hit tail',
          target: '#SnakeMachine.Game Over'
        }
      ],
      on: {
        TICK: {
          actions: 'move snake'
        },
        ARROW_KEY: {
          actions: 'save dir',
          target: '#SnakeMachine.Moving'
        }
      }
    },
    'Game Over': {
      on: {
        NEW_GAME: {
          actions: 'reset',
          description: 'triggered by pressing the "r" key',
          target: '#SnakeMachine.New Game'
        }
      }
    }
  }
});
