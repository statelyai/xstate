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
  /** @xstate-layout N4IgpgJg5mDOIC5QGUB2BDA1mAsugxgBYCWqYAdAHJgDuABAOLoC2YAxAIIBKXA8gOoB9ANIBRAJoBtAAwBdRKAAOAe1jEALsWWoFIAB6IAjNIBM08gBYAnAA4bANisBWG1YsB2exYA0IAJ6I9u7kTlZhnob29oZOJu7uAL4JvmhYuAQkZOQ4ygBupFCcPAIiEjLySCAqapraugYIhiZm5K7Rtu5O0u4eNr4BCAC09k7knhZ2AMyT0oY2pk1JKRjYeESkFDn5qIXoADY06H6w5brVGlo6lQ2GFk4W5CM2LoaTVkEWk-b9iJ8hTe4rE17F93A4nEsQKlVhkNtk8gU2PtDsdJIYKkpVBc6tcjBYgpZ3MY7FZJsZpNIfP5ECZJg8rCYmrMbGS6R4TJDoel1lktojkUcTiYMVUsbUrqAbk5DMEQdNpHZrF5nj8EJMTFZyNInGSFUS7mS7pyVtzMpsETs2HpYOp0OoKOgAGb2gBOAAp5gBKNhctZm+HbKCnSrncX1RBhSbkOaGGLuUyObomVXNB7SsEmVwWEweKxg41pP1wpisOi8XJgF1sSiiIQMDg4UTBzE1S7hxqp8jTQxWSkyvO01UWWNdmw9UlOewKzMcyGoZQQOC6X2wshnMVt3EIME2UfTGYTGwGpyqwa3KNfQ-xqbxxLJKEmotZaj0EtgdetnGSxAs+x7+WHseqquCEYRgW40hvDqEL3iuPLmoGH7YhK+hGGYf7DhMYJAoCk6qk4wRAnEzwsjqkFAgWMLweQb5lhWLpIWGW4xG85BmJMR6UvicROCe1IIBY1jRpMnTggRCojBYSRJEAA */
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
