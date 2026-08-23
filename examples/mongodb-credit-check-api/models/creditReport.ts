import type { BureauName } from './creditProfile';

export interface CreditReport {
  ssn: string;
  bureauName: BureauName;
  creditScore: number;
}
