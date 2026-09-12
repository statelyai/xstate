import './App.css';
import { useMachine } from '@xstate/react';
import { tilesMachine } from './tilesMachine';

function TileGrid({
  children,
  image
}: {
  children: React.ReactNode;
  image: string;
}) {
  return (
    <div
      style={{
        height: '320px',
        width: '320px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        backgroundImage: `url(${image})`,
        backgroundSize: '400% 400%'
      }}
    >
      {children}
    </div>
  );
}

function Tile({
  tile,
  highlight,
  ...divProps
}: {
  tile: number;
  highlight: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        backgroundImage: 'inherit',
        backgroundSize: '400% 400%',
        backgroundPosition: `${((tile % 4) * 100) / 3}% ${(Math.floor(tile / 4) * 100) / 3}%`,
        filter: highlight ? 'brightness(1.1)' : 'brightness(1)',
        userSelect: 'none'
      }}
      {...divProps}
    >
      <span
        style={{
          background: '#fff',
          color: '#172554',
          padding: '2px 6px',
          borderRadius: '4px'
        }}
      >
        {tile + 1}
      </span>
    </div>
  );
}

function App() {
  const [state, send] = useMachine(tilesMachine);

  return (
    <div className="App">
      <TileGrid image="/puzzle.svg">
        {state.context.tiles.map((tile, index) => {
          const x = index % 4;
          const y = Math.floor(index / 4);
          const highlight =
            index === state.context.hovered?.index ||
            index === state.context.selected?.index;

          return (
            <Tile
              key={tile}
              tile={tile}
              onMouseDown={() =>
                send({
                  type: 'tile.select',
                  tile: {
                    index,
                    x,
                    y
                  }
                })
              }
              onMouseEnter={() =>
                send({
                  type: 'tile.hover',
                  tile: {
                    index,
                    x,
                    y
                  }
                })
              }
              onMouseUp={() => send({ type: 'tile.move' })}
              highlight={highlight}
            />
          );
        })}
      </TileGrid>
      <button
        onClick={() => send({ type: 'shuffle' })}
        disabled={!state.can({ type: 'shuffle' })}
      >
        Shuffle
      </button>
    </div>
  );
}

export default App;
