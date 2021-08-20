const { Machine, actions } = require('../../lib');
const { interpret } = require('../../lib/interpreter');
const { getValueAdjacencyMap } = require('../../lib/graph');

const isValidMoveFor = (player) => (xs, e) => {
  return e.player === player && xs.board[e.value] === null;
};

const checkWin = (player) => (xs, e) => {
  const { board } = xs;
  const winningLines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (let line of winningLines) {
    const playerWon = line.every((index) => {
      return board[index] === player;
    });

    if (playerWon) {
      return true;
    }
  }
};

const ticTacToeMachine = Machine(
  {
    initial: 'x turn',
    states: {
      'x turn': {
        on: {
          '': [
            {
              target: 'winner x',
              cond: checkWin('x')
            },
            {
              target: 'winner o',
              cond: checkWin('o')
            }
          ],
          PLAY: [
            {
              target: 'o turn',
              cond: isValidMoveFor('x'),
              actions: [
                actions.assign({
                  board: (xs, e) => {
                    const newBoard = [...xs.board];
                    newBoard[e.value] = e.player;
                    return newBoard;
                  },
                  moves: (xs) => xs.moves + 1
                }),
                checkWin
              ]
            },
            { actions: [() => console.log('Illegal move')] }
          ]
        }
      },
      'o turn': {
        on: {
          '': [
            {
              target: 'winner x',
              cond: checkWin('x')
            },
            {
              target: 'winner o',
              cond: checkWin('o')
            }
          ],
          PLAY: [
            {
              target: 'x turn',
              cond: isValidMoveFor('o'),
              actions: [
                actions.assign({
                  board: (xs, e) => {
                    const newBoard = [...xs.board];
                    newBoard[e.value] = e.player;
                    return newBoard;
                  },
                  moves: (xs) => xs.moves + 1
                })
              ]
            },
            { actions: [() => console.log('Illegal move')] }
          ]
        }
      },
      'winner x': {
        on: {
          PLAY: undefined
        }
      },
      'winner o': {
        on: {
          PLAY: undefined
        }
      }
    }
  },
  {},
  {
    board: Array(9).fill(null),
    moves: 0
  }
);

const service = interpret(ticTacToeMachine, (e) => {
  // console.log(e.value);
  // console.log(e.ext);
  // console.log('\n');
});

// interpreter.init();

const valueAdjacencyMap = getValueAdjacencyMap(ticTacToeMachine, {
  events: {
    PLAY: [
      { type: 'PLAY', player: 'x', value: 0 },
      { type: 'PLAY', player: 'x', value: 1 },
      { type: 'PLAY', player: 'x', value: 2 },
      { type: 'PLAY', player: 'x', value: 3 },
      { type: 'PLAY', player: 'x', value: 4 },
      { type: 'PLAY', player: 'x', value: 5 },
      { type: 'PLAY', player: 'x', value: 6 },
      { type: 'PLAY', player: 'x', value: 7 },
      { type: 'PLAY', player: 'x', value: 8 },
      { type: 'PLAY', player: 'o', value: 0 },
      { type: 'PLAY', player: 'o', value: 1 },
      { type: 'PLAY', player: 'o', value: 2 },
      { type: 'PLAY', player: 'o', value: 3 },
      { type: 'PLAY', player: 'o', value: 4 },
      { type: 'PLAY', player: 'o', value: 5 },
      { type: 'PLAY', player: 'o', value: 6 },
      { type: 'PLAY', player: 'o', value: 7 },
      { type: 'PLAY', player: 'o', value: 8 }
    ]
  }
});

Object.keys(valueAdjacencyMap)
  .filter((key) => {
    const adjacencies = valueAdjacencyMap[key];

    return key.includes('winner o');
  })
  .map((key) => {
    const [state, ext] = key.split(' | ');
    const extValue = JSON.parse(ext);

    return extValue;
  })
  .filter((ext) => ext.moves === 5)
  .map(({ board }) => {
    const b = board.map((cell) => (cell === null ? '_' : cell));
    return [
      [b[0], b[1], [b[2]]],
      [b[3], b[4], [b[5]]],
      [b[6], b[7], [b[8]]]
    ]
      .map((a) => a.join(''))
      .join('\n');
  })
  .forEach((a) => console.log(a + '\n'));
// .map(key => valueAdjacencyMap[key]);

// interpreter.init();

// interpreter.send({ type: 'PLAY', player: 'x', value: 0 });
// interpreter.send({ type: 'PLAY', player: 'o', value: 1 });
// interpreter.send({ type: 'PLAY', player: 'x', value: 3 });
// interpreter.send({ type: 'PLAY', player: 'o', value: 4 });
// interpreter.send({ type: 'PLAY', player: 'o', value: 5 });
// interpreter.send({ type: 'PLAY', player: 'x', value: 6 });
// interpreter.send({ type: 'PLAY', player: 'o', value: 0 });
// interpreter.send({ type: 'PLAY', player: 'x', value: 0 });
