import { Col, Row } from "react-bootstrap";
import GuessOptions from "./GuessOptions";
import CharacterPicture from "./CharacterPicture";
import Lose from "./Lose";
import Win from "./Win";
import LoadingOverlay from "react-loading-overlay-ts";
import { TriviaMachineContext } from "../../context/AppContext";

const GamePanel = () => {
  const state = TriviaMachineContext.useSelector(state => state)
  const { context } = state
  return (
    <LoadingOverlay
      active={!context.hasLoaded}
      spinner
      text="Loading your content..."
    >
      <Row>
      <Col xs={12}>
        {state.matches({startTrivia: {
          questionReady: "lostGame"
        }}) ? 
        <Lose />
      : state.matches({startTrivia: {
          questionReady: "wonGame"
        }}) ?  
        <Win />
       : <div>
       <CharacterPicture />
       <GuessOptions />
     </div>}
      </Col>
      </Row>
    </LoadingOverlay>
  );
};

export default GamePanel;
