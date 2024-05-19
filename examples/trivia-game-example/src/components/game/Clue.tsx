import { useState, useEffect } from "react";
import { Popover, OverlayTrigger, Button } from "react-bootstrap";
import { RickCharacters } from "../../services/RickApi";
import { RMEpisode, ClueProps } from "../../common/types";
import { TriviaMachineContext } from "../../context/AppContext";

const Clue = (props: ClueProps) => {
  const isClueOpened = TriviaMachineContext.useSelector(state => state.context.isClueOpened)
  const triviaActorRef = TriviaMachineContext.useActorRef()
  const [episode, setEpisode] = useState<RMEpisode | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    if (props.episode) {
      RickCharacters.getClue(props.episode)
        .then((data: RMEpisode) => {
          if (isMounted) setEpisode(data);
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      setEpisode(null);
    }
    return () => {
      isMounted = false;
    };
  }, [props.episode]);

  const popover = (
    <Popover id="popover-basic">
      <Popover.Title as="h3">Clue</Popover.Title>
        <Popover.Content>
          {episode && (
            <span>
              <strong>This character apeared in:</strong>{" "}
              {episode.name.toUpperCase()}
              <br />
              <strong>Episode #</strong> {episode.episode}
              <br />
              <strong>Date #</strong> {episode.air_date}
            </span>
          )}
        </Popover.Content>
    </Popover>
  );

  return (
    <div className="text-center">
      {episode && (
        <OverlayTrigger show={isClueOpened} placement="bottom" overlay={popover}>
          <Button variant="primary" size="lg" onClick={() => triviaActorRef.send({type: "user.toggleClue"})}>
            Need a clue?
          </Button>
        </OverlayTrigger>
      )}
    </div>
  );
};

export default Clue;
