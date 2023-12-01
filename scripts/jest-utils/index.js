const { consoleSpies } = require('./console-spies');

module.exports.clearConsoleMocks = () =>
  Object.values(consoleSpies).forEach((spy) => spy.mockClear());

module.exports.sleep = (ms) => new Promise((res) => setTimeout(res, ms));
