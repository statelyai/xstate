import { useState } from "react";
import { RMCharacter } from "../../common/types";
import { append, sortBy, prop } from "ramda";
import { Button } from "../styled/Button";
import { Option } from "../styled/Option";
import { TriviaMachineContext } from "../../context/AppContext";

const GuessOptions = () => {
  const context = TriviaMachineContext.useSelector(state => state.context)
  const triviaActorRef = TriviaMachineContext.useActorRef()
  const generateQuestions = (): RMCharacter[] => {
    if (context.hasLoaded && context.randomCharacters.length > 0) {
      const randomOptions: RMCharacter[] = context.randomCharacters.filter(
          (character: RMCharacter) => character.id !== context.currentCharacter!.id
        )
        .map((character: RMCharacter) => {
          return character;
        });
      const sortById = sortBy(prop("id"));
      return sortById(append(context.currentCharacter!, randomOptions));
    } else {
      return [];
    }
  };

  const [revealAnswer, setRevealAnswer] = useState<boolean>(false);

  const itemVariant = (character: number) => {
    if (revealAnswer && context.hasLoaded) {
      if (character === context.currentCharacter!.id) {
        return "success";
      }
      return "danger";
    }
  };
  
  return (
    <div>
      <h2 className="text-center py-4">Who's this?</h2>
      {context.hasLoaded && (
        <div className="text-center">
          <fieldset disabled={revealAnswer}>
            {generateQuestions().map((character: RMCharacter) => {
              return (
                <Option
                  key={character.id}
                  variant={itemVariant(character.id)}
                  onClick={() => {
                    triviaActorRef.send({
                      type: "user.selectAnswer",
                      answer:character.id
                    });
                    setRevealAnswer(true);
                  }}
                >
                  {character.name}
                </Option>
              );
            })}
          </fieldset>
          <Button
            className="mt-3"
            onClick={() => {
              setRevealAnswer(false);
              triviaActorRef.send({type:"user.nextQuestion"})
            }}
            primary
          >
            NEXT
          </Button>
        </div>
      )}
    </div>
  );
};

export default GuessOptions;
