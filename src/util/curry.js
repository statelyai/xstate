

export default function curry(fn) {
  let arity = fn.length;

  return function f1() {
    let args = [...arguments];

    if (args.length >= arity) {
      return fn.apply(null, args);
    } else {
      return () => f1.apply(null, [...args, ...arguments]);
    }
  };
}