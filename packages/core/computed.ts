type ResolvedContext<TContextConfig extends {}> = {
  [K in keyof TContextConfig]: TContextConfig[K] extends (
    ...args: any
  ) => infer R
    ? R
    : TContextConfig[K];
};

export function computed<T extends {}>(views: T): ResolvedContext<T> {
  const computedContext = {};
  const stack: Array<string | symbol> = [];
  const viewProxy = new Proxy(views, {
    get: (_, prop) => {
      if (computedContext[prop]) {
        return computedContext[prop];
      }
      const value = views[prop];
      if (typeof value !== 'function') {
        return value;
      }
      if (stack.includes(prop)) {
        throw new Error(
          `Detected computed property cycle: ${stack.join(
            ' → '
          )} → ${prop.toString()}`
        );
      }
      stack.push(prop);
      computedContext[prop] = views[prop](viewProxy);
      stack.pop();
      return computedContext[prop];
    }
  });

  return viewProxy as ResolvedContext<T>;
}
