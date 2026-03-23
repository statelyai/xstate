import { Col, Container, Row } from 'react-bootstrap';
import Image from 'react-bootstrap/Image';
import { TriviaMachineContext } from '../../context/AppContext';

const CharacterPicture = () => {
  const context = TriviaMachineContext.useSelector((state) => state.context);
  return (
    <Container>
      <Row>
        <Col xs={12} md={12} className="text-center">
          {context.hasLoaded && context.currentCharacter && (
            <Image
              className="img-character"
              src={context.currentCharacter.image}
              roundedCircle
            />
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default CharacterPicture;
