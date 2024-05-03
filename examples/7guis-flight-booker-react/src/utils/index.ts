// CONSTANTS
export const TODAY = new Date().toISOString().split("T")[0];

export const TOMORROW = new Date(Date.now() + 86400000)
  .toISOString()
  .split("T")[0];

// Emulate async operation
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
