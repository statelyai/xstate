import { Col, Container, Row } from 'react-bootstrap';
import Image from 'react-bootstrap/Image';
import type { FallbackProps } from 'react-error-boundary';
import { Button } from '../styled/Button';
import { TriviaMachineContext } from '../../context/AppContext';

/**
 * Rendered both as the machine's fetch-failure UI and as the
 * `<ErrorBoundary>` fallback, hence the optional `FallbackProps`.
 */
const DisplayError = ({ resetErrorBoundary }: Partial<FallbackProps>) => {
  const triviaActorRef = TriviaMachineContext.useActorRef();
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
          <p>
            This game calls the public Rick &amp; Morty API, so it needs a
            working network connection.
          </p>
          <Button
            onClick={() => {
              resetErrorBoundary?.();
              triviaActorRef.send({ type: 'user.retry' });
            }}
            $primary
          >
            TRY AGAIN
          </Button>
        </Col>
      </Row>
    </Container>
  );
};

export default DisplayError;
