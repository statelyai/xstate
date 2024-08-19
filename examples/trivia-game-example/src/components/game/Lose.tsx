import { Col, Container, Row } from 'react-bootstrap';
import Image from 'react-bootstrap/Image';
import { Button } from '../styled/Button';
import { TriviaMachineContext } from '../../context/AppContext';

const Lose = () => {
  const context = TriviaMachineContext.useSelector((state) => state.context);
  const triviaActorRef = TriviaMachineContext.useActorRef();
  return (
    <Container>
      <Row>
        <Col xs={12} md={12} className="text-center">
          <Image
            className="img-character"
            src="https://rickandmortyapi.com/api/character/avatar/597.jpeg"
            roundedCircle
          />
          <h2 className="trivia">YOU LOST!</h2>
          {context.hasLoaded && (
            <Button
              onClick={() => triviaActorRef.send({ type: 'user.playAgain' })}
              primary
            >
              PLAY AGAIN
            </Button>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default Lose;
