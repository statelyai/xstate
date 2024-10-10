const { toMatchInlineSnapshot } = require('jest-snapshot');
const { consoleSpies, spyOnConsole } = require('./console-spies');

expect.extend({
  toMatchMockCallsInlineSnapshot(received, ...rest) {
    if (!jest.isMockFunction(received)) {
      throw new Error(
        '`toMatchMockCallsInlineSnapshot` can only be used on mocked functions'
      );
    }

    const calls = received.mock.calls;
    received.mockClear();
    return toMatchInlineSnapshot.call(this, calls, ...rest);
  }
});

afterEach(() => {
  Object.keys(consoleSpies).forEach((method) => {
    const spy = consoleSpies[method];

    if (spy.mock.calls.length) {
      spy.mock.calls = spy.mock.calls.filter(
        (args) =>
          !args.includes(
            'Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.'
          )
      );
    }

    if (spy.mock.calls.length) {
      const calls = spy.mock.calls;

      spy.mockRestore();
      // actually log the "unobserved" calls to the console to make them observable in the test output
      calls.forEach((args) => console[method](...args));
      // as we just restored the mock, we need to setup a new spy
      consoleSpies[method] = spyOnConsole(method);

      if (process.env.CI) {
        throw new Error(
          [
            `console.${method} was called unexpectedly ${calls.length} times without observing its calls with \`expect(console.${method}).toMatchMockCallsInlineSnapshot()\`.`,
            `You can check the observed calls above.`
          ].join(' ')
        );
      }
    }
  });
});
