export function reportUnhandledError(err: unknown) {
  setTimeout(() => {
    throw err;
  });
}
