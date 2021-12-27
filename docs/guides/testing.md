# Testing Machines

In general, testing state machines and statecharts should be done by testing the _overall behavior_ of the machine; that is:

> Given a **current state**, when some **sequence of events** occurs, the system under test should be in **a certain state** and/or exhibit a specific **output**.

This follows [behavior-driven development (BDD)](https://en.wikipedia.org/wiki/Behavior-driven_development) and [black-box testing](https://en.wikipedia.org/wiki/Black-box_testing) strategies. The internal workings of a machine should not be directly tested; rather, the observed behavior should be tested instead. This makes testing machines closer to integration or end-to-end (E2E) tests than unit tests.

## Testing pure logic

If you do not want to test side-effects, such as executing actions or invoking actors, and want to instead test pure logic, the `machine.transition(...)` function can be used to assert that a specific state is reached given an initial state and an event:

```js
import { lightMachine } from '../path/to/lightMachine';

it('should reach "yellow" given "green" when the "TIMER" event occurs', () => {
  const expectedValue = 'yellow'; // the expected state value

  const actualState = lightMachine.transition('green', { type: 'TIMER' });

  expect(actualState.matches(expectedValue)).toBeTruthy();
});
```

## Testing services

The behavior and output of services can be tested by asserting that it _eventually_ reaches an expected state, given an initial state and a sequence of events:

```js
import { fetchMachine } from '../path/to/fetchMachine';

it('should eventually reach "success"', (done) => {
  const fetchService = interpret(fetchMachine).onTransition((state) => {
    // this is where you expect the state to eventually
    // be reached
    if (state.matches('success')) {
      done();
    }
  });

  fetchService.start();

  // send zero or more events to the service that should
  // cause it to eventually reach its expected state
  fetchService.send({ type: 'FETCH', id: 42 });
});
```

::: tip
Keep in mind that most testing frameworks have a default timeout, and the async tests are expected to finish before that timeout. Configure the timeout if necessary ([e.g., `jest.setTimeout(timeout)`](https://jestjs.io/docs/en/jest-object#jestsettimeouttimeout)) for longer-running tests.
:::

## Mocking effects

Since actions and invoking/spawning actors are side-effects, it might be undesirable to execute them in a testing environment. You can use the `machine.withConfig(...)` option to change the implementation details of certain actions:

```js
import { fetchMachine } from '../path/to/fetchMachine';

it('should eventually reach "success"', (done) => {
  let userAlerted = false;

  const mockFetchMachine = fetchMachine.withConfig({
    services: {
      fetchFromAPI: (_, event) =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ id: event.id });
          }, 50);
        })
    },
    actions: {
      alertUser: () => {
        // set a flag instead of executing the original action
        userAlerted = true;
      }
    }
  });

  const fetchService = interpret(mockFetchMachine).onTransition((state) => {
    if (state.matches('success')) {
      // assert that effects were executed
      expect(userAlerted).toBeTruthy();
      done();
    }
  });

  fetchService.start();

  fetchService.send({ type: 'FETCH', id: 42 });
});
```
