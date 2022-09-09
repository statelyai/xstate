const { TextEncoder, TextDecoder } = require('util');

// ref: https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
// ref: https://github.com/jsdom/jsdom/issues/2524
Object.defineProperty(window, 'TextEncoder', {
  writable: true,
  value: TextEncoder
});
Object.defineProperty(window, 'TextDecoder', {
  writable: true,
  value: TextDecoder
});
