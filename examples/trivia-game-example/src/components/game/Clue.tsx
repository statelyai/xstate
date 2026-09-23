import { useActor } from '@xstate/react';
import { Popover, OverlayTrigger, Button } from 'react-bootstrap';
import { ClueProps } from '../../common/types';
import { TriviaMachineContext } from '../../context/AppContext';
import { clueMachine } from './clueMachine';

const Clue = (props: ClueProps) => {
  const isClueOpened = TriviaMachineContext.useSelector(
    (state) => state.context.isClueOpened
  );
  const triviaActorRef = TriviaMachineContext.useActorRef();
  // The parent keys this component by episode, so a new character mounts a
  // fresh actor with the new `input` instead of re-running an effect.
  const [snapshot] = useActor(clueMachine, {
    input: { url: props.episode }
  });
  const episode = snapshot.context.episode;

  const popover = (
    <Popover id="popover-basic">
      <Popover.Header as="h3">Clue</Popover.Header>
      <Popover.Body>
        {episode && (
          <span>
            <strong>This character appeared in:</strong>{' '}
            {episode.name.toUpperCase()}
            <br />
            <strong>Episode #</strong> {episode.episode}
            <br />
            <strong>Date #</strong> {episode.air_date}
          </span>
        )}
      </Popover.Body>
    </Popover>
  );

  return (
    <div className="text-center">
      {episode && (
        <OverlayTrigger
          show={isClueOpened}
          placement="bottom"
          overlay={popover}
        >
          <Button
            variant="primary"
            size="lg"
            onClick={() => triviaActorRef.send({ type: 'user.toggleClue' })}
          >
            Need a clue?
          </Button>
        </OverlayTrigger>
      )}
    </div>
  );
};

export default Clue;
