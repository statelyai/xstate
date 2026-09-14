import { z } from 'zod';
import { collections } from './actorService';
import type { CreditReport } from '../models/creditReport';
import type { BureauName, CreditProfile } from '../models/creditProfile';

export const userCredentialSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  SSN: z.string().length(9)
});

export type UserCredential = z.infer<typeof userCredentialSchema>;

// A real implementation would look the user up; here the input is only validated.
export async function verifyCredentials(credentials: UserCredential) {
  console.log('Verifying credentials...');
  return userCredentialSchema.parse(credentials);
}

/** Given three scores, returns the middle one. */
export function determineMiddleScore(scores: number[]) {
  return [...scores].sort((a, b) => a - b)[1];
}

/**
 * Looks for a report that was already fetched for this SSN and bureau. A real
 * implementation would also check how old the report is.
 */
export async function checkReportsTable({
  ssn,
  bureauName
}: {
  ssn: string;
  bureauName: BureauName;
}) {
  console.log(`Checking for an existing ${bureauName} report...`);
  const report = await collections.creditReports?.findOne({ ssn, bureauName });
  return (report as CreditReport | null) ?? undefined;
}

/** Simulates a slow call to a credit bureau. */
export async function checkBureauService({
  bureauName
}: {
  ssn: string;
  bureauName: BureauName;
}) {
  console.log(`Calling the ${bureauName} bureau...`);
  await sleep(range({ min: 1000, max: 10000 }));
  return range({ min: 300, max: 850 });
}

/** Simulates a slow call to a rate service. */
export async function generateInterestRate(creditScore: number) {
  await sleep(range({ min: 1000, max: 10000 }));
  if (creditScore > 700) return 3.5;
  if (creditScore > 600) return 5;
  return 200;
}

export async function saveCreditReport(report: CreditReport) {
  await collections.creditReports?.replaceOne(
    { ssn: report.ssn, bureauName: report.bureauName },
    report,
    { upsert: true }
  );
}

export async function saveCreditProfile(profile: CreditProfile) {
  await collections.creditProfiles?.replaceOne({ SSN: profile.SSN }, profile, {
    upsert: true
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function range({ min, max }: { min: number; max: number }) {
  return Math.floor(Math.random() * (max - min) + min);
}
