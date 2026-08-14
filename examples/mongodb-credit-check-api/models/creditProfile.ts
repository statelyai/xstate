export const BUREAU_NAMES = ['EquiGavin', 'GavUnion', 'Gavperian'] as const;

export type BureauName = (typeof BUREAU_NAMES)[number];

export interface CreditProfile {
  SSN: string;
  FirstName: string;
  LastName: string;
  /** Credit score per bureau. `0` means "not retrieved". */
  scores: Record<BureauName, number>;
  MiddleScore: number;
  InterestRateOptions: number[];
  ErrorMessage: string;
}
