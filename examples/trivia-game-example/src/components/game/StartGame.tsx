import { Button } from '../styled/Button';
import { TriviaMachineContext } from '../../context/AppContext';
import ImgsBack from '../layout/ImgsBack';
import LoadingOverlay from 'react-loading-overlay-ts';

const StartGame = () => {
  const triviaActorRef = TriviaMachineContext.useActorRef();
  const state = TriviaMachineContext.useSelector((state) => state);
  const { homePageCharacters, hasLoaded } = state.context;

  const actorRef = TriviaMachineContext.useActorRef();
  if (state.context.error)
    return (
      <div role="alert">
        {state.context.error}{' '}
        <button onClick={() => actorRef.send({ type: 'user.retry' })}>
          Retry
        </button>
      </div>
    );
  return (
    <div className="container">
      <div className="row">
        <div className="col-md-12 text-center">
          <h1 className="trivia">Who is who?</h1>
          <LoadingOverlay
            active={!hasLoaded}
            spinner
            text="Loading your content..."
          >
            {hasLoaded && (
              <>
                <Button
                  onClick={() => triviaActorRef.send({ type: 'user.play' })}
                  primary
                >
                  PLAY
                </Button>
                {homePageCharacters.length > 0 && (
                  <ImgsBack characters={homePageCharacters} />
                )}
              </>
            )}
          </LoadingOverlay>
        </div>
      </div>
    </div>
  );
};

export default StartGame;
