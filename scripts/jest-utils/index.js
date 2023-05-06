const { consoleSpies } = require('./console-spies');

module.exports.clearConsoleMocks = () =>
  Object.values(consoleSpies).forEach((spy) => spy.mockClear());
