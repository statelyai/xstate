import { createMachine } from 'xstate';

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
  /** @xstate-layout N4IgpgJg5mDOIC5QGUB2BDA1mAsugxgBYCWqYAdAHJgDuABAOLoC2YAxAIIBKXA8gOoB9ANIBRAJoBtAAwBdRKAAOAe1jEALsWWoFIAB6IArNICc5ACzSAHCYBMAdhMA2AIzTD9w+YA0IAJ6ILs7kJsbS0i4AzPbmTpG2LuYAvkm+aFi4BCRk5DjKAG6kUJw8AiISMvJIICpqmtq6BghBtuSRJtGGLrbmtlaGvgEIhrattiYTzuYm0vb2Tk4paRjYeESkFHmFqMXoADY06H6wlbq1Glo61U1eVuSJncauDrYD-kaj5OOTTtOz84tUiB0qsshtcgUimx9odjpIXFUlKoLg1rkYnNIQoYnK9zFZ7NJIl0fO8EPZXuRTJNyU5sdElsCVpl1jktlCYUcTrZETVkfUrqAmtNzBYTI4XOS7NJplZBogrC5DJTJs4FqEZoYGSDmdlNpCdmw9LB1Oh1BR0AAzM0AJwAFFZpABKNjata6iHbKCnarnfmNRCRfH3aQ4wxWHoS9py4afb4TX4zOYLLVMt3gpisOi8fJga1sSiiIQMDg4UTepF1S7+hAY6MuBVfcLhFwYjq4lJA1DKCBwXSusFkM58qto5q2OutJtT6fhZJA-ssijUegZsBDyuowVGaxtWxElsa8xeFzRmzkQwqiaWdqGSKA5YZNOs-VQdcogX6IyK+4zXEtqz9OYJJDJE0TkFYOIysK7iJPYKaPgOFCrlmObWm+fqjiMdxiuMQQhvYiruNGGrKj8sxEkBHZJEAA */
  id: 'SnakeMachine',
  types: {
    context: {} as SnakeMachineContext,
    events: {} as { type: 'NEW_GAME' } | { type: 'ARROW_KEY'; dir: Dir }
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
      after: {
        '80': {
          target: '#SnakeMachine.Moving'
        }
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
