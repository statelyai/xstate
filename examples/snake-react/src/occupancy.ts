import type { SnakeMachineContext, GameObject } from './snakeMachine.ts';

export function createOccupancyIndex(context: SnakeMachineContext) {
  const cells = new Map<string, GameObject>();
  for (let index = 1; index < context.snake.length; index++) {
    const part = context.snake[index];
    const key = `${part.x},${part.y}`;
    if (!cells.has(key)) cells.set(key, { type: 'body', dir: part.dir });
  }
  cells.set(`${context.apple.x},${context.apple.y}`, {
    type: 'apple',
    dir: undefined
  });
  const head = context.snake[0];
  if (head)
    cells.set(`${head.x},${head.y}`, { type: 'head', dir: context.dir });
  return cells;
}
