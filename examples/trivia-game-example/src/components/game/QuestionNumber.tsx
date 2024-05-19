import { Badge, Spinner } from "react-bootstrap";
import Clue from "./Clue";
import { TriviaMachineContext } from "../../context/AppContext";

const QuestionNumber = () => {
  const state = TriviaMachineContext.useSelector(state => state)
  const { context } = state
  const question =
    context.hasLoaded ? (
      <span>{context.question}</span>
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
          Question #{" "}
          <Badge role="question-counter" variant="secondary">
            {question}
          </Badge>
        </div>

        {context.hasLoaded && context.currentCharacter && (
          <Clue episode={context.currentCharacter.episode[0]} />
        )}
      </h1>
    </div>
  );
};

export default QuestionNumber;
