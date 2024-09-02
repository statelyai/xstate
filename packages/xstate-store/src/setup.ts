export function setup<const T extends { emitted: any }>({ emitted }: T) {
  return {
    createStore: {}
  };
}
