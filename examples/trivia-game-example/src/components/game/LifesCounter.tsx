import { Badge, Spinner } from 'react-bootstrap';
import { TriviaMachineContext } from '../../context/AppContext';

const LifesCounter = () => {
  const context = TriviaMachineContext.useSelector((state) => state.context);

  const lifes = context.hasLoaded ? (
    <span>{context.lifes}</span>
  ) : (
    <Spinner
      className="small-spinner"
      animation="border"
      size="sm"
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </Spinner>
  );

  return (
    <div className="text-right">
      <h1>
        <div className="text-center">
          Lifes{' '}
          <Badge variant="secondary" role="lifes-counter">
            {lifes}/3
          </Badge>
        </div>
      </h1>
    </div>
  );
};

export default LifesCounter;
