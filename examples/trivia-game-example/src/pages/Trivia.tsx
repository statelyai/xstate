import React from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import QuestionNumber from '../components/game/QuestionNumber';
import LifesCounter from '../components/game/LifesCounter';
import GameTitle from '../components/layout/GameTitle';
import PointCounter from '../components/game/PointCounter';
import GamePanel from '../components/game/GamePanel';
import { ErrorBoundary } from 'react-error-boundary';
import DisplayError from '../components/layout/DisplayError';

const errorHandler = (error: Error, info: { componentStack: string }) => {
  console.log(error, info);
};

const Trivia: React.FC = () => {
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
