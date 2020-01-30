function isIterable(obj) {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj) &&
    typeof obj[window.Symbol.iterator] === 'function';
}

export default isIterable