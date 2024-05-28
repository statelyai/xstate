import { createMachine } from 'xstate';
import { adjacencyMapToArray, createTestModel } from '../src';

describe('adjacency maps', () => {
  it('model generates an adjacency map (converted to an array)', () => {
    const machine = createMachine({
      initial: 'standing',
      states: {
        standing: {
          on: {
            left: 'walking',
            right: 'walking',
            down: 'crouching',
            up: 'jumping'
          }
        },
        walking: {
          on: {
            up: 'jumping',
            stop: 'standing'
          }
        },
        jumping: {
          on: {
            land: 'standing'
          }
        },
        crouching: {
          on: {
            release_down: 'standing'
          }
        }
      }
    });
    const model = createTestModel(machine);

    expect(
      adjacencyMapToArray(model.getAdjacencyMap()).map(
        ({ state, event, nextState }) =>
          `Given Mario is ${state.value}, when ${event.type}, then ${nextState.value}`
      )
    ).toMatchInlineSnapshot(`
      [
        "Given Mario is standing, when left, then walking",
        "Given Mario is standing, when right, then walking",
        "Given Mario is standing, when down, then crouching",
        "Given Mario is standing, when up, then jumping",
        "Given Mario is walking, when up, then jumping",
        "Given Mario is walking, when stop, then standing",
        "Given Mario is walking, when up, then jumping",
        "Given Mario is walking, when stop, then standing",
        "Given Mario is crouching, when release_down, then standing",
        "Given Mario is jumping, when land, then standing",
        "Given Mario is jumping, when land, then standing",
        "Given Mario is standing, when left, then walking",
        "Given Mario is standing, when right, then walking",
        "Given Mario is standing, when down, then crouching",
        "Given Mario is standing, when up, then jumping",
        "Given Mario is standing, when left, then walking",
        "Given Mario is standing, when right, then walking",
        "Given Mario is standing, when down, then crouching",
        "Given Mario is standing, when up, then jumping",
        "Given Mario is standing, when left, then walking",
        "Given Mario is standing, when right, then walking",
        "Given Mario is standing, when down, then crouching",
        "Given Mario is standing, when up, then jumping",
      ]
    `);
  });

  it('function generates an adjacency map (converted to an array)', () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: {
          on: {
            TIMER: 'yellow'
          }
        },
        yellow: {
          on: {
            TIMER: 'red'
          }
        },
        red: {
          on: {
            TIMER: 'green'
          }
        }
      }
    });

    const arr = adjacencyMapToArray(createTestModel(machine).getAdjacencyMap());

    expect(
      arr.map((x) => ({
        state: x.state.value,
        event: x.event.type,
        nextState: x.nextState.value
      }))
    ).toMatchInlineSnapshot(`
[
  {
    "event": "TIMER",
    "nextState": "yellow",
    "state": "green",
  },
  {
    "event": "TIMER",
    "nextState": "red",
    "state": "yellow",
  },
  {
    "event": "TIMER",
    "nextState": "green",
    "state": "red",
  },
  {
    "event": "TIMER",
    "nextState": "yellow",
    "state": "green",
  },
]
`);
  });
});
