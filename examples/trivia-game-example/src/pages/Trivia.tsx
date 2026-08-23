import type { ErrorInfo } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { ErrorBoundary } from 'react-error-boundary';
import QuestionNumber from '../components/game/QuestionNumber';
import LifesCounter from '../components/game/LifesCounter';
import GameTitle from '../components/layout/GameTitle';
import PointCounter from '../components/game/PointCounter';
import GamePanel from '../components/game/GamePanel';
import DisplayError from '../components/layout/DisplayError';

const errorHandler = (error: unknown, info: ErrorInfo) => {
  console.error(error, info);
};

const Trivia = () => {
  return (
    <>
      <GameTitle />
      <Container>
        <ErrorBoundary FallbackComponent={DisplayError} onError={errorHandler}>
          <Row>
            <Col xs={12} md={6}>
              <QuestionNumber />
            </Col>
            <Col xs={12} md={6}>
              <PointCounter />
              <LifesCounter />
            </Col>
          </Row>
          <GamePanel />
        </ErrorBoundary>
      </Container>
    </>
  );
};

export default Trivia;
