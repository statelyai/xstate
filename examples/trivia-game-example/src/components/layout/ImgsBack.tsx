import React from "react";
import { ImgBack } from "../styled/ImgBack";
import { RMCharacter } from "../../common/types";

interface CharacterProps {
  characters: RMCharacter[];
}

const ImgsBack: React.FC<CharacterProps> = (props: CharacterProps) => {
  return (
    <div>
      {props.characters.slice(0, 20).map((character: RMCharacter) => {
        return (
          <ImgBack key={character.id}>
            <img
              className="card-img-top"
              alt={character.name}
              src={character.image}
              data-holder-rendered="true"
            />
          </ImgBack>
        );
      })}
    </div>
  );
};

export default ImgsBack;
