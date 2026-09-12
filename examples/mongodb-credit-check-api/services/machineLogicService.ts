import { z } from 'zod';
import { collections } from './actorService';
import CreditReport from '../models/creditReport';
import CreditProfile from '../models/creditProfile';

const userCredentialSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  SSN: z.string().min(9).max(9)
});

export type userCredential = z.infer<typeof userCredentialSchema>;

// this would be a great place to lookup the user in a database and confirm they exist
// for now, we will just validate the input and return it
export function verifyCredentials(credentials: userCredential) {
  console.log('Verifying Credentials...');
  try {
    userCredentialSchema.parse(credentials);
    return Promise.resolve(credentials);
  } catch (err) {
    const errorMessage = 'Invalid Credentials. Details: ' + String(err);
    console.log(errorMessage);
    return Promise.reject(new Error(errorMessage));
  }
}
// given an array of 3 scores, return the middle score
//remember, it's not production code, it's a sample!
export function determineMiddleScore(scores: number[]) {
  if (scores.length !== 3 || scores.some((score) => !Number.isFinite(score))) {
    return Promise.reject(new Error('Expected three finite credit scores'));
  }
  return Promise.resolve([...scores].sort((a, b) => a - b)[1]);
}

// this is where we would check the database to see if we have an existing report for this user
// note: in real-world scenarios, you'd want to check the date of the report to see if it's stale
// for this sample, we will just return the report if it exists
export async function checkReportsTable({
  ssn,
  bureauName
}: {
  ssn: string;
  bureauName: string;
}) {
  console.log('Checking for an existing report....');
  try {
    if (!collections.creditReports)
      throw new Error('Credit reports collection is not initialized');
    const report = await collections.creditReports.findOne({
      ssn,
      bureauName
    });
    return report as CreditReport | null;
  } catch (err) {
    console.log('Error checking reports table', err);
    throw err;
  }
}

// simulates a potentially long-running call to a bureau service
// returns a random number representing a credit score between 300 and 850
export async function checkBureauService({
  ssn,
  bureauName
}: {
  ssn: string;
  bureauName: string;
}) {
  void ssn;
  switch (bureauName) {
    case 'GavUnion':
      await sleep(range({ min: 1000, max: 10000 }));
      return range({ min: 300, max: 850 });
    case 'EquiGavin':
      await sleep(range({ min: 1000, max: 10000 }));
      return range({ min: 300, max: 850 });
    case 'Gavperian':
      await sleep(range({ min: 1000, max: 10000 }));
      return range({ min: 300, max: 850 });
    default:
      throw new Error('Unknown credit bureau');
  }
}

// this can indeed be a very long-running service,
// typically one that won't be local to the application
// for this sample, we will just simulate a long-running call
export async function generateInterestRate(creditScore: number) {
  await sleep(range({ min: 1000, max: 10000 }));
  if (creditScore > 700) {
    return 3.5;
  } else if (creditScore > 600) {
    return 5;
  } else {
    return 200;
  }
}

// saves the specific credit report to the database, by SSN and bureau name
export async function saveCreditReport(report: CreditReport) {
  try {
    if (!collections.creditReports)
      throw new Error('Credit reports collection is not initialized');
    const result = await collections.creditReports.replaceOne(
      {
        ssn: report.ssn,
        bureauName: report.bureauName
      },
      report,
      { upsert: true }
    );
    if (!result.acknowledged)
      throw new Error('Credit report write was not acknowledged');
  } catch (err) {
    console.log('Error saving credit report', err);
    throw err;
  }
}
// saves the entire credit credit profile to the database
export async function saveCreditProfile(profile: CreditProfile) {
  try {
    if (!collections.creditProfiles)
      throw new Error('Credit profiles collection is not initialized');
    const result = await collections.creditProfiles.replaceOne(
      {
        SSN: profile.SSN
      },
      profile,
      { upsert: true }
    );
    if (!result.acknowledged)
      throw new Error('Credit profile write was not acknowledged');
  } catch (err) {
    console.log('Error saving credit profile', err);
    throw err;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function range({ min, max }: { min: number; max: number }) {
  return Math.floor(Math.random() * (max - min) + min);
}
