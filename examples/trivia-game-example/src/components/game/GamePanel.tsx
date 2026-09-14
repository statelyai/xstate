import { Col, Row } from 'react-bootstrap';
import LoadingOverlay from 'react-loading-overlay-ts';
import GuessOptions from './GuessOptions';
import CharacterPicture from './CharacterPicture';
import Lose from './Lose';
import Win from './Win';
import DisplayError from '../layout/DisplayError';
import { TriviaMachineContext } from '../../context/AppContext';

const GamePanel = () => {
  const state = TriviaMachineContext.useSelector((state) => state);

  const panel = state.matches({ startTrivia: 'loadFailed' }) ? (
    <DisplayError />
  ) : state.matches({ startTrivia: { questionReady: 'lostGame' } }) ? (
    <Lose />
  ) : state.matches({ startTrivia: { questionReady: 'wonGame' } }) ? (
    <Win />
  ) : (
    <div>
      <CharacterPicture />
      <GuessOptions />
    </div>
  );

  return (
    <LoadingOverlay
      active={!state.context.hasLoaded}
      spinner
      text="Loading your content..."
    >
      <Row>
        <Col xs={12}>{panel}</Col>
      </Row>
    </LoadingOverlay>
  );
};

export default GamePanel;
