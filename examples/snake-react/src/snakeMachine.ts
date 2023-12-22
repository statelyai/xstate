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
  /** @xstate-layout N4IgpgJg5mDOIC5QGUB2BDA1mAsugxgBYCWqYAdAHJgDuABAOLoC2YAxAIIBKXA8gOoB9ANIBRAJoBtAAwBdRKAAOAe1jEALsWWoFIAB6IAnACZyARkMA2AKzGAzHcMAOawBY7TuwBoQAT0QWluSG1tJhZnYA7K6WdsbSTgC+iT5oWLgEJGTkOMoAbqRQnDwCIhIy8kggKmqa2roGCK4m5NaG7YauxrHS1nHWPv4I1rbkxh1WzdKRkZaWyakY2HhEpBS5BahFAAocAKrIohW6NRpaOlWNdpbS5NEdkWEuJtKWg4g3TuSWE5Fms-YFiA0stMmscvlCmx0AAbGjoXywY5VU51C6gRqWJyRch2MzGUL4ywWLrePyIEamcYdSxTGZzIEgjKrbIbKGw+GIyRmSpKVRneqXRCPW740LSMzTSXGfHvBCRaxBMxzOZuLrGbGGRlLZlZdaQrbQuEIpHGXnVflohofP7kJwhTzGDVmbHSVxypwxb4Te12VyKn7a9IrPUQzZFPSwdTodQUdAAM1jACcABROaQASjYTJD4LZW2RfNq52tCBucspYwmtMM01m8xSwJ1ueyTFYdF4eTASbYlFEQgYHBwRzkJ0tJaF8qcX3c+Pc6de1mVcpdZjGYXCN0M-VcQdBLIo23QAFdYJA2Fw4MfWIWLcXBRjEE619Ios0sRY+nYBuSywlvQ8-yWICQKoMoEBwLoOZgmQY73ui+iIAAtK4ThykhMytBM7SuK+ITXHuurgtQ9BtmAcECghjT4jingkjE8QxPOHqGFh2G4Y4fQNoswYwfq4YUVak6YX8tj1nMCSGGYcp+l81LtJ4Hi2K8hEthQZEdl2SaCROj4IOmQT2tYniko4Trur+25BD8HSKS48TWKpfHkEep6QDpD6IQg9g4s0kRSbhr5ODcDhygq1jkNIvzdIqUTJMkQA */
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

        PAUSE: "Paused"
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

    Paused: {
      on: {
        Resume: "Moving"
      }
    }
  }
});
