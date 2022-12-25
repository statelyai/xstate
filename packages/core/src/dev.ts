const LOG = false;

export function devLog(...args: any[]) {
  if (LOG) {
    console.log(...args);
  }
}
