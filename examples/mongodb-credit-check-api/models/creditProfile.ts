import { ObjectId } from "mongodb";

export default class CreditProfile {
  constructor(
    public SSN: string,
    public LastName: string,
    public FirstName: string,
    public GavUnionScore: number,
    public EquiGavinScore: number,
    public GavperianScore: number,
    public ErrorMessage: string,
    public MiddleScore: number,
    public InterestRateOptions: number[],
    public _id?: ObjectId,
  ) {}
}
