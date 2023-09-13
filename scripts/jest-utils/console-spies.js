const spyOnConsole = (method) =>
  jest.spyOn(console, method).mockImplementation(() => {});

module.exports.spyOnConsole = spyOnConsole;

module.exports.consoleSpies = {
  error: spyOnConsole('error'),
  info: spyOnConsole('info'),
  log: spyOnConsole('log'),
  warn: spyOnConsole('warn')
};
