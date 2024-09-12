import { Container, Jumbotron } from 'react-bootstrap';

const GameTitle = () => {
  return (
    <Jumbotron className="text-center py-3">
      <Container>
        <h1 className="small-trivia">
          <img
            width="300px"
            src="https://occ-0-3412-3934.1.nflxso.net/dnm/api/v6/LmEnxtiAuzezXBjYXPuDgfZ4zZQ/AAAABddiw4GEUq76B3fmiI7r6NF-GrWeEf99MjwKrfixFKM4B4o1uuitcgbuBNa3n04L5GSamUi2vex4adduBV-S2XGERxn29-ffvoRv.png?r=a6e"
          />
          TRIVIA
        </h1>
      </Container>
    </Jumbotron>
  );
};

export default GameTitle;
