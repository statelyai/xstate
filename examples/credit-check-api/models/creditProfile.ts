import { ObjectId } from "mongodb";

export default class CreditProfile {
  _id?: ObjectId;
  SSN: string;
  LastName: string;
  FirstName: string;
  GavUnionScore: number;
  EquiGavinScore: number;
  GavperianScore: number;
  ErrorMessage: string;
  MiddleScore: number;
  InterestRateOptions: number[];
  constructor(
    SSN: string,
    LastName: string,
    FirstName: string,
    GavUnionScore: number,
    EquiGavinScore: number,
    GavperianScore: number,
    ErrorMessage: string,
    MiddleScore: number,
    InterestRateOptions: number[]
  ) {
    this.SSN = SSN;
    this.LastName = LastName;
    this.FirstName = FirstName;
    this.GavUnionScore = GavUnionScore;
    this.EquiGavinScore = EquiGavinScore;
    this.GavperianScore = GavperianScore;
    this.ErrorMessage = ErrorMessage;
    this.MiddleScore = MiddleScore;
    this.InterestRateOptions = InterestRateOptions;
  }
}
