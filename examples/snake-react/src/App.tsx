import { useEffect } from 'react';
import { useActor } from '@xstate/react';
import {
  SnakeMachineContext,
  createInitialContext,
  snakeMachine
} from './snakeMachine';
import { assign } from 'xstate';

type Dir = SnakeMachineContext['dir'];
type Point = SnakeMachineContext['gridSize'];
type BodyPart = SnakeMachineContext['snake'][0];
type Snake = SnakeMachineContext['snake'];

const oppositeDir: Record<Dir, Dir> = {
  Up: 'Down',
  Down: 'Up',
  Left: 'Right',
  Right: 'Left'
};

function isSamePos(p1: Point, p2: Point) {
  return p1.x === p2.x && p1.y === p2.y;
}

function isOutsideGrid(gridSize: Point, p: Point) {
  return p.x < 0 || p.x >= gridSize.x || p.y < 0 || p.y >= gridSize.y;
}

function find<T extends Point>(points: T[], p: Point) {
  return points.find((pp) => isSamePos(pp, p));
}

function head(snake: Snake) {
  return snake[0];
}

function body(snake: Snake) {
  return snake.slice(1);
}

function newHead(oldHead: BodyPart, dir: Dir): BodyPart {
  switch (dir) {
    case 'Up':
      return { x: oldHead.x, y: oldHead.y - 1, dir };
    case 'Down':
      return { x: oldHead.x, y: oldHead.y + 1, dir };
    case 'Left':
      return { x: oldHead.x - 1, y: oldHead.y, dir };
    case 'Right':
      return { x: oldHead.x + 1, y: oldHead.y, dir };
  }
}

function moveSnake(snake: Snake, dir: Dir): Snake {
  return [newHead(head(snake), dir), ...snake.slice(0, -1)];
}

function randomGridPoint(gridSize: Point): Point {
  return {
    x: Math.floor(Math.random() * gridSize.x),
    y: Math.floor(Math.random() * gridSize.y)
  };
}

function newApple(gridSize: Point, ineligibleGridPoints: Point[]) {
  let newApple = randomGridPoint(gridSize);
  while (find(ineligibleGridPoints, newApple)) {
    newApple = randomGridPoint(gridSize);
  }
  return newApple;
}

function growSnake(snake: Snake): Snake {
  return [...snake, snake[snake.length - 1]];
}

type GameObject =
  | { type: 'head'; dir: Dir }
  | { type: 'body'; dir: Dir }
  | { type: 'apple'; dir: undefined };
function getGamObjectAtPos(
  context: SnakeMachineContext,
  p: Point
): GameObject | undefined {
  let maybeBodyPart: BodyPart | undefined;
  if (isSamePos(head(context.snake), p)) {
    return { type: 'head', dir: context.dir };
  } else if (isSamePos(context.apple, p)) {
    return { type: 'apple', dir: undefined };
  } else if ((maybeBodyPart = find(body(context.snake), p))) {
    return { type: 'body', dir: maybeBodyPart.dir };
  } else {
    return undefined;
  }
}

const configuredSnakeMachine = snakeMachine.provide({
  guards: {
    'ate apple': ({ context }) => isSamePos(head(context.snake), context.apple),
    'hit tail': ({ context }) =>
      !!find(body(context.snake), head(context.snake)),
    'hit wall': ({ context }) =>
      isOutsideGrid(context.gridSize, head(context.snake))
  },
  actions: {
    'move snake': assign({
      snake: ({ context }) => moveSnake(context.snake, context.dir)
    }),
    'save dir': assign({
      dir: ({ context, event }) => {
        return event.type === 'ARROW_KEY'
          ? event.dir !== oppositeDir[context.dir]
            ? event.dir
            : context.dir
          : context.dir;
      }
    }),
    'increase score': assign({
      score: ({ context }) => context.score + 1,
      highScore: ({ context }) => Math.max(context.score + 1, context.highScore)
    }),
    'show new apple': assign({
      apple: ({ context }) => newApple(context.gridSize, context.snake)
    }),
    'grow snake': assign({ snake: ({ context }) => growSnake(context.snake) }),
    reset: assign(({ context }) => ({
      ...createInitialContext(),
      highScore: context.highScore
    }))
  }
});

function App() {
  const [current, send] = useActor(configuredSnakeMachine);
  const { gridSize, score, highScore } = current.context;
  const isGameOver = current.matches('Game Over');
  console.log(current);

  useEffect(() => {
    function keyListener(event: KeyboardEvent) {
      const [maybeKey, maybeDir] = event.key.split('Arrow');
      if (maybeDir) {
        send({ type: 'ARROW_KEY', dir: maybeDir as Dir });
      } else if (maybeKey === 'r') {
        send({ type: 'NEW_GAME' });
      }
    }

    window.addEventListener('keydown', keyListener);
    return () => window.removeEventListener('keydown', keyListener);
  }, [send]);

  return (
    <div className="App">
      <header>
        <h1 style={{ marginBottom: 0 }}>XSnake</h1>
        <p style={{ margin: 0 }}>Snake with a sweet twist, built with XState</p>
      </header>
      <p style={{ fontSize: '1.2em', marginBottom: 0 }}>
        {isGameOver ? 'Game Over!' : '\u00A0'}
      </p>
      <p>
        Score: {score}
        <br />
        High score: {highScore}
      </p>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${gridSize.x}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize.y}, 1fr)`
        }}
      >
        {Array.from({ length: gridSize.y }).map((_, row) =>
          Array.from({ length: gridSize.x }).map((_, col) => {
            const { type, dir } =
              getGamObjectAtPos(current.context, { x: col, y: row }) || {};
            return (
              <div className="cell" key={`${col} ${row}`}>
                <span
                  role="img"
                  aria-label={type}
                  className={type}
                  data-dir={dir}
                />
              </div>
            );
          })
        )}
      </div>
      <p style={{ fontSize: '0.7em' }}>
        Press arrow keys to move, "r" for new game.
      </p>
    </div>
  );
}

export default App;
