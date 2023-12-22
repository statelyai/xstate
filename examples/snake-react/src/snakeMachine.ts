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
  /** @xstate-layout N4IgpgJg5mDOIC5QGUB2BDA1mAsugxgBYCWqYAdAHJgDuABAOLoC2YAxAIIBKXA8gOoB9ANIBRAJoBtAAwBdRKAAOAe1jEALsWWoFIAB6IArNICc5ACzSAHCYBMAdhMA2AIzTD9w+YA0IAJ6ILs7kJuYmJvbmTvYuni5OhgC+ib5oWLgEJGTkOMoAbqRQnDwCIhIy8kggKmqa2roGCEG25ADMJq1xtua2VmEdvgEIhrYttuHOEVb2Nk62yakY2HhEpBS5BahF6AA2NOh+sBW6NRpaOlWNXlbkLuadhsauDraGg0aj5OPhTlMzzvMUiA0stMmscvlCmxdvtDpIXJUlKozvVLkYnNIQoY5td7NJWoY7u8EPZXuRTOFLNJzIT-gtgUsMqtshsoTCDkdbIjqsi6hdQI0wuYLBETLFxrZqSYrMSrC5DOSJu1zGEXK1uvSQUysutIVs2HpYOp0OoKOgAGamgBOAAorNIAJRsLUrHUQzZQY5VU58hqIVrTW7SHFWbqxdrB4kjMYTX4zf5zTWM13gpisOi8PJgK1sSiiIQMDg4URepG1c5+hAY4kuOW3CaREzBlVCpPpFMsvVFAAKHAAqsgS3ITryK2iSZ1yF4Er1ojYCTL-P7SW1em4rK0Cc8nG3QcyKN30ABXWCQNhcOBH1ilnnl1ECxD2TfkVwjeyklzxTrE+6Y5zYzdOkcFVpmSIFUGUCA4F0F0wTIEc735fRAlsGsXBCCZMKwqwdyBWD9yoWhGBYMAEJRJCrmsVcCXiJsvC8FxZTMQwsNCfETEMAld21cFWS2MjfXHIUQgcJw5VGHDpAcN4lwQVpzBub4Ii-bFLBcbiOwoNMwAzLMrQEscH2GXoQlJMUm2ieV3GJOjFXCAMrE46xcMWds4IPY9TwgAz72QhAbGFWxWmsLxgvMWJa2JTp0JGOVpFJfEXG6cwwMSIA */
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
