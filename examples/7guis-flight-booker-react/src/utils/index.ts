export function generateDate(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
}

// Emulate async operation
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
