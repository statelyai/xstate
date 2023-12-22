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
  /** @xstate-layout N4IgpgJg5mDOIC5QGUB2BDA1mAsugxgBYCWqYAdAHJgDuABAOLoC2YAxAIIBKXA8gOoB9ANIBRAJoBtAAwBdRKAAOAe1jEALsWWoFIAB6IAzAHYAbOUOmAnGcMBGACwAmaQA4nrgDQgAnojtW5lYOVlauVgCstqYeDgC+cd5oWLgEJGTkOMoAbqRQnDwCIhIy8kggKmqa2roGCAFOFlYmMXZOUabSbt5+CBFOjYZd0sbSTqaGEaYRhglJGNh4RKQUWbmo+egANjToPrClupUaWjrldREOruSOhsFODv3N0nY9iP2Dw6Pjk9OziSBkos0itMjk8mxtrt9pI7GUlKoTjVzu9OuRIqYHI9pA4uv03ghjO0bsNrIZXHYIu5jHNAQtUssMmsIVC9gcnPCKojqmdQBdDI0iUTTMZjI5THYBQSKRESV0HDEHG07jSAUCGelVuCNmw9LB1Oh1BR0AAzI0AJwAFK5pABKNjqpaasHrKCHcrHHm1IyuYwkiYtX1RQwOAkfCxfMYTKYzWmOkEZJisOi8bJgc1sSiiIQMDg4UTuhFVU7ehCdAl2CnkFzDCJ2MX9HFx+lO0HMnUABQ4AFVkAW5EduSWUX1feRwrjXAqTJSnASHkFjAKG3ZpOSrhFmylW4mWGA6B30ABXWCQNhcUTIbv5wtc4vIvmIMzScgfNwN6SRK4EpXXF4OYwQlMaY3AA0wEgBVBlAgOBdHjRkwEHe9eX0fw518NDyGGLpgJA6QJRsLdgQQqhaEYPckKRFC6kcBxyBFDxXGAywbQmYxpSsejhjaJxDEsMxHCIjU221KBKK9EdLDscdXFcCJLmAiIrDXUwCRDa4hmGZpfWnKwhJ3Cgk33VN03E4dH3qGYLFMX1KxsB4lRDAllNlVcul4tzwhs-SE0MvcD2PU8IDMh9UMJNx0VXexrCpStjCsCtZKaX1OhmVwhniCCgA */
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
        },

        PAUSE: "Game Paused"
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
    },

    "Game Paused": {
      on: {
        RESUME: "Moving"
      }
    }
  }
});
