import { ReactNode } from "react";


export type RMCharacter = {
  id: number;
  name: string;
  status: string;
  species: string;
  gender: string;
  image: string;
  episode: string[];
};

export type RMEpisode = {
  id: number;
  name: string;
  air_date: string;
  episode: string;
  characters: string[];
  url: string;
  created: string;
};


export interface ClueProps {
  episode: string | null;
}

export interface PropsNode {
  children: ReactNode;
}

export interface State {
  hasError: boolean;
}
