import { ObjectId } from "mongodb";

export default class CreditReport {
  _id?: ObjectId;
  ssn: string;
  bureauName: string;
  creditScore: number;
  constructor(ssn: string, bureauName: string, creditScore: number) {
    this.ssn = ssn;
    this.bureauName = bureauName;
    this.creditScore = creditScore;
  }
}
