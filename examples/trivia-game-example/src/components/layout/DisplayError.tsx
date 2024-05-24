import { Col, Container, Row } from "react-bootstrap";
import Image from "react-bootstrap/Image";
import { Button } from "../styled/Button";
import { TriviaMachineContext } from "../../context/AppContext";

const DisplayError = () => {
  const triviaActorRef = TriviaMachineContext.useActorRef()
  const state = TriviaMachineContext.useSelector((state) => state)
  const { hasLoaded } = state.context
  return (
    <Container>
      <Row>
        <Col xs={12} md={12} className="text-center">
          <Image
            className="img-character"
            src="https://rickandmortyapi.com/api/character/avatar/225.jpeg"
            roundedCircle
          />
          <h2 className="trivia">Sorry there was an error!</h2>
          {hasLoaded && (
            <Button onClick={() => triviaActorRef.send({type: "user.playAgain"})} primary>
              PLAY AGAIN
            </Button>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default DisplayError;
