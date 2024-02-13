import { ObjectId } from "mongodb";

export default class CreditReport {
  constructor(
    public ssn: string,
    public bureauName: string,
    public creditScore: number,
    public _id?: ObjectId,
  ) {}
}
