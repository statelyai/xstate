import { useState } from 'react';
import { RMCharacter } from '../../common/types';
import { Button } from '../styled/Button';
import { Option } from '../styled/Option';
import { TriviaMachineContext } from '../../context/AppContext';

const GuessOptions = () => {
  const context = TriviaMachineContext.useSelector((state) => state.context);
  const triviaActorRef = TriviaMachineContext.useActorRef();
  const [revealAnswer, setRevealAnswer] = useState(false);

  const { currentCharacter, randomCharacters, hasLoaded } = context;

  const generateQuestions = (): RMCharacter[] => {
    if (!hasLoaded || !currentCharacter || randomCharacters.length === 0) {
      return [];
    }
    const others = randomCharacters.filter(
      (character) => character.id !== currentCharacter.id
    );
    return [...others, currentCharacter].sort((a, b) => a.id - b.id);
  };

  const itemVariant = (id: number): 'success' | 'danger' | undefined => {
    if (!revealAnswer || !currentCharacter) return undefined;
    return id === currentCharacter.id ? 'success' : 'danger';
  };

  return (
    <div>
      <h2 className="text-center py-4">Who's this?</h2>
      {hasLoaded && (
        <div className="text-center">
          <fieldset disabled={revealAnswer}>
            {generateQuestions().map((character) => (
              <Option
                key={character.id}
                $variant={itemVariant(character.id)}
                onClick={() => {
                  triviaActorRef.send({
                    type: 'user.selectAnswer',
                    answer: character.id
                  });
                  setRevealAnswer(true);
                }}
              >
                {character.name}
              </Option>
            ))}
          </fieldset>
          <Button
            className="mt-3"
            onClick={() => {
              setRevealAnswer(false);
              triviaActorRef.send({ type: 'user.nextQuestion' });
            }}
            $primary
          >
            NEXT
          </Button>
        </div>
      )}
    </div>
  );
};

export default GuessOptions;
