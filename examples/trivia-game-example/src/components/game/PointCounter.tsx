import { Badge, Spinner } from 'react-bootstrap';
import { TriviaMachineContext } from '../../context/AppContext';

const PointCounter = () => {
  const context = TriviaMachineContext.useSelector((state) => state.context);

  const points = context.hasLoaded ? (
    <span role="point-counter">{context.points}</span>
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
          Points{' '}
          <Badge className="points" variant="secondary">
            {points}
          </Badge>
        </div>
      </h1>
    </div>
  );
};

export default PointCounter;
