import { createMachine } from 'xstate';
import { createTestModel } from '../src';

describe('model.getAdjacencyList()', () => {
  it('generates an adjacency list', () => {
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
      model
        .getAdjacencyList()
        .map(
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
});
