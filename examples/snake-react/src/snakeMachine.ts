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
  /** @xstate-layout N4IgpgJg5mDOIC5QGUB2BDA1mAsugxgBYCWqYAdAHJgDuABAOLoC2YAxAIIBKXA8gOoB9ANIBRAJoBtAAwBdRKAAOAe1jEALsWWoFIAB6IALAA4A7OVOmATAE4AjFel3jNpwFYANCACeiOzYA2chs3aTC7AGZTQwCIqzsAXwSvNCxcAhIychxlADdSKE4eAREJGXkkEBU1TW1dAwRDGytyNxt2m0MrWOk3CLsvXwQ+ltsOgKbpSwCApJSMbDwiUgoc-NRCgAUOAFVkUXLdao0tHUqGiIDpCyb20zDjNv9PH0Q3Y2NyAI6bUztTAJWMZzECpRYZFbZPIFNjoAA2NHQ3lgh0qx1qZ1ADQCZnI-SsoQcAX8XSsgzecXIY3aE1c01myVBC3Syyyaxh8MRyMkdgqSlUJzq50Q92uDlCTimdmk8QGrwQpku5DsMxmbkMpLMNhBYJZmVW0I2sIRSJRVj5VQFGPqiFiES+qtiTSsf065IQxm6Xx+LgihjcM21jN1S31UPWhT0sHU6HUFHQADM4wAnAAUxmkAEo2CGIWzDVBUfyaqcbQgru6RlSfrSpgCGfM0qHIUxWHReLkwMm2JRREIGBwcAc5EcraXhQqPuRDPiZxnpAE3HYXkNnHYqWFwlcbHF1Trmc2spt0ABXWCQNhcOAn1hFy0loVYxBA9fSKJNHHPCJ+iKVqffDo-gBIF2iSRlUGUCA4F0XNWTAUcH0xfREAAWhMd0UMsVofnaQw3xCCI3H3Js8woah6FbeC0THR9kI9JUImMb8ImkExjH9Qj3RcbCcLwiICKI4MD1I8MCgQwUkIaQxFWrFVFysYwJhiUx3T9T5qRsJjGLcRwGyZEi4PISj207ZNxOtCdPTcG5AI1KYCRU+V7CCAD2i0x5HEExtwUM48z0gczxyfBA-UMcgPm-WxjGXQx-gCd1FWs6QfmsRdYlMMCEiAA */
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
