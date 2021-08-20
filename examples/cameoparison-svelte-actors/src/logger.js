const dftPreorderRecursive = (service, level = 0) => {
  if (
    service?.onTransition &&
    typeof service.onTransition === 'function' &&
    service?.children
  ) {
    level++;
    service.onTransition((state) => {
      console.log('-'.repeat(level), service.id, state);
      service.children.forEach((child) => dftPreorderRecursive(child, level));
    });
  }
};

export const log = dftPreorderRecursive;
